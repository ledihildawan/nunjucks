import { dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import Loader from './loader.js';
import { ErrorFormatter, NunjucksError } from './bun-error.js';

export { precompileToSQLite } from './bun-sqlite-precompile.js';

let SQLite;
try {
  SQLite = require('bun:sqlite');
} catch (e) {
  SQLite = null;
}

export class BunSQLitePrecompiledLoader extends Loader {
  constructor(dbPath, opts = {}) {
    super();
    this.dbPath = dbPath;
    this.opts = opts;
    this.cache = {};
    this.pathsToNames = {};
    this.async = true;
    this.mode = opts.mode || 'development';
    this.autoPrecompile = opts.autoPrecompile !== false;
    this.templateDir = opts.templateDir || dirname(dbPath);

    this._initDB();
    this._errorFormatter = new ErrorFormatter(dbPath, { mode: this.mode });
  }

  _initDB() {
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    if (this.autoPrecompile && !existsSync(this.dbPath)) {
      this._precompileSync();
    }
  }

  _precompileSync() {
    if (!this.autoPrecompile) return;
    if (!SQLite) return;

    try {
      const { precompileToSQLite } = require('./bun-sqlite-precompile.js');
      precompileToSQLite(this.templateDir, this.dbPath, { force: true });
    } catch (e) {
      console.error('[SQLite Loader] Auto-precompile failed:', e.message);
    }
  }

  _getDB() {
    if (SQLite) {
      return new SQLite.Database(this.dbPath);
    }
    return null;
  }

  _getSourceMap(name) {
    const db = this._getDB();
    if (!db) return null;

    try {
      const stmt = db.prepare(
        'SELECT compiled_line, original_line, original_col FROM _sourcemaps WHERE name = ? ORDER BY compiled_line'
      );
      const rows = stmt.all(name);
      db.close();

      if (rows.length > 0) {
        return rows.map(row => ({
          compiledLine: row.compiled_line,
          originalLine: row.original_line,
          originalCol: row.original_col
        }));
      }
      return null;
    } catch (e) {
      db.close();
      return null;
    }
  }

  _getTemplateUUID(name) {
    const db = this._getDB();
    if (!db) return null;

    try {
      const stmt = db.prepare('SELECT uuid FROM _compiled_templates WHERE name = ?');
      const row = stmt.get(name);
      db.close();
      return row?.uuid || null;
    } catch (e) {
      db.close();
      return null;
    }
  }

  _getSourceContent(name) {
    const db = this._getDB();
    if (!db) return null;

    try {
      const stmt = db.prepare('SELECT source_content FROM _compiled_templates WHERE name = ?');
      const row = stmt.get(name);
      db.close();
      return row?.source_content || null;
    } catch (e) {
      db.close();
      return null;
    }
  }

  get(name) {
    if (this.cache[name]) {
      return this.cache[name];
    }

    const db = this._getDB();
    let template = null;

    if (SQLite) {
      const stmt = db.prepare('SELECT template, uuid FROM _compiled_templates WHERE name = ?');
      const row = stmt.get(name);
      if (row) {
        try {
          const func = new Function(row.template);
          template = func();
          if (template) {
            const sourceMap = this._getSourceMap(name);
            if (sourceMap) {
              template.__sourceMap = sourceMap;
            }
            template.__uuid = row.uuid;
            template.__name = name;
          }
        } catch (e) {
          console.error(`[SQLite] Error loading template ${name}:`, e.message);
        }
      }
      db.close();
    }

    if (template) {
      this.cache[name] = template;
    }

    return template;
  }

  has(name) {
    return this.get(name) !== null;
  }

  async getSource(name) {
    const template = this.get(name);
    if (!template) {
      return null;
    }

    return {
      src: {
        type: 'code',
        obj: template
      },
      path: name
    };
  }

  setMode(mode) {
    this.mode = mode;
    this._errorFormatter.setMode(mode);
  }

  getMode() {
    return this.mode;
  }

  async formatError(error, templateName, includeChain = null) {
    return this._errorFormatter.formatError(error, templateName, includeChain);
  }

  getTemplateUUID(name) {
    return this._getTemplateUUID(name);
  }

  close() {
    if (this.db && this.db.close) {
      this.db.close();
    }
    this._errorFormatter.close();
  }
}

export function createSQLiteLoader(dbPath, opts) {
  return new BunSQLitePrecompiledLoader(dbPath, opts);
}
