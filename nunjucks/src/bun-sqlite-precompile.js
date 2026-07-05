import { existsSync, statSync, readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import {_prettifyError} from './lib.js';
import * as compiler from './compiler.js';
import {Environment} from './environment.js';

let SQLite;
try {
  SQLite = require('bun:sqlite');
} catch (e) {
  SQLite = null;
}

function match(filename, patterns) {
  if (!Array.isArray(patterns)) {
    return false;
  }
  return patterns.some((pattern) => filename.match(pattern));
}

function hashContent(content) {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

function normalizePathSeparators(p) {
  return p.split('\\').join('/');
}

function _precompile(str, name, env) {
  env = env || new Environment([]);

  const asyncFilters = env.asyncFilters;
  const extensions = env.extensionsList;

  name = normalizePathSeparators(name);

  try {
    return compiler.compile(str,
      asyncFilters,
      extensions,
      name,
      env.opts);
  } catch (err) {
    throw _prettifyError(name, false, err);
  }
}

export function precompileToSQLite(templateDir, dbPath, opts = {}) {
  opts = opts || {};
  const env = opts.env || new Environment([]);
  const extensions = opts.extensions || ['.njk', '.html', '.j2'];
  const exclude = opts.exclude || [];

  let db;
  if (SQLite) {
    db = new SQLite.Database(dbPath);
  } else {
    throw new Error('bun:sqlite is required for precompileToSQLite. Use Bun runtime.');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS _compiled_templates (
      name TEXT PRIMARY KEY,
      template TEXT NOT NULL,
      hash TEXT NOT NULL,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  const results = [];
  let updated = 0;
  let skipped = 0;

  function addTemplates(dir, baseDir) {
    readdirSync(dir).forEach((file) => {
      const filepath = join(dir, file);
      const base = baseDir || templateDir;
      let subpath = normalizePathSeparators(filepath.slice(base.length)).replace(/^\//, '');

      const stat = statSync(filepath);

      if (stat && stat.isDirectory()) {
        subpath = subpath + '/';
        if (!match(subpath, exclude)) {
          addTemplates(filepath, base);
        }
      } else if (extensions.some(ext => file.endsWith(ext))) {
        if (!match(subpath, exclude)) {
          results.push({ filepath, name: subpath });
        }
      }
    });
  }

  const pathStats = existsSync(templateDir) && statSync(templateDir);

  if (pathStats.isDirectory()) {
    addTemplates(templateDir);

    for (let i = 0; i < results.length; i++) {
      const { filepath, name } = results[i];

      try {
        const source = readFileSync(filepath, 'utf-8');
        const contentHash = hashContent(source);
        const compiledCode = _precompile(source, name, env);

        const existing = db.prepare('SELECT hash FROM _compiled_templates WHERE name = ?').get(name);

        if (existing && existing.hash === contentHash) {
          skipped++;
          continue;
        }

        const stmt = db.prepare(
          'INSERT OR REPLACE INTO _compiled_templates (name, template, hash) VALUES (?, ?, ?)'
        );
        stmt.run(name, compiledCode, contentHash);
        updated++;

        console.log(`[SQLite] Precompiled: ${name}`);
      } catch (e) {
        if (opts.force) {
          console.error(`[SQLite] Error precompiling ${name}:`, e.message);
        } else {
          throw e;
        }
      }
    }
  } else if (pathStats.isFile()) {
    const name = normalizePathSeparators(basename(templateDir)).replace(/^\//, '');

    const source = readFileSync(templateDir, 'utf-8');
    const contentHash = hashContent(source);
    const compiledCode = _precompile(source, name, env);

    const existing = db.prepare('SELECT hash FROM _compiled_templates WHERE name = ?').get(name);

    if (!existing || existing.hash !== contentHash) {
      const stmt = db.prepare(
        'INSERT OR REPLACE INTO _compiled_templates (name, template, hash) VALUES (?, ?, ?)'
      );
      stmt.run(name, compiledCode, contentHash);
      updated++;
      console.log(`[SQLite] Precompiled: ${name}`);
    } else {
      skipped++;
    }

    results.push({ name, filepath: templateDir });
  }

  if (db.close) {
    db.close();
  }

  console.log(`[SQLite] Done: ${updated} updated, ${skipped} skipped (hash unchanged)`);
  return results.map(r => r.name);
}

export function loadFromSQLite(dbPath) {
  if (!SQLite) {
    console.warn('[SQLite] Bun.sqlite not available');
    return { _templates: new Map() };
  }

  try {
    const db = new SQLite.Database(dbPath);
    const templates = {};

    const rows = db.prepare('SELECT name, template FROM _compiled_templates').all();

    for (const row of rows) {
      try {
        const func = new Function(row.template);
        templates[row.name] = func();
      } catch (e) {
        console.error(`[SQLite] Error loading template ${row.name}:`, e.message);
      }
    }

    db.close();
    return templates;
  } catch (e) {
    return {};
  }
}

export function clearSQLite(dbPath) {
  if (SQLite) {
    const db = new SQLite.Database(dbPath);
    db.exec('DELETE FROM _compiled_templates');
    db.close();
    console.log('[SQLite] Cleared all precompiled templates');
  }
}
