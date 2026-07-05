import { dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import Loader from './loader.js';

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

    this._initDB();
  }

  _initDB() {
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  _getDB() {
    if (SQLite) {
      return new SQLite.Database(this.dbPath);
    }
    return null;
  }

  get(name) {
    if (this.cache[name]) {
      return this.cache[name];
    }

    const db = this._getDB();
    let template = null;

    if (SQLite) {
      const stmt = db.prepare('SELECT template FROM _compiled_templates WHERE name = ?');
      const row = stmt.get(name);
      if (row) {
        try {
          const func = new Function(row.template);
          template = func();
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

  close() {
    if (this.db && this.db.close) {
      this.db.close();
    }
  }
}

export function createSQLiteLoader(dbPath, opts) {
  return new BunSQLitePrecompiledLoader(dbPath, opts);
}
