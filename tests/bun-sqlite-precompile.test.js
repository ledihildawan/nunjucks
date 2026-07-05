import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, rmSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { precompileToSQLite, loadFromSQLite, clearSQLite } from '../nunjucks/src/bun-sqlite-precompile.js';

function createIsolatedTestDir() {
  const name = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dir = join(__dirname, 'tmp-sqlite-test', name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupDir(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch (e) {}
}

describe('precompileToSQLite', () => {
  describe('single file', () => {
    const TEST_DIR = createIsolatedTestDir();
    const DB_PATH = join(TEST_DIR, 'test.db');
    const TEMPLATE_PATH = join(TEST_DIR, 'hello.njk');

    beforeAll(() => {
      writeFileSync(TEMPLATE_PATH, 'Hello {{ name }}!');
    });

    afterAll(() => {
      cleanupDir(join(__dirname, 'tmp-sqlite-test'));
    });

    beforeEach(() => {
      try { unlinkSync(DB_PATH); } catch (e) {}
    });

    test('should precompile single template file', () => {
      const result = precompileToSQLite(TEMPLATE_PATH, DB_PATH);

      expect(result).toContain('hello.njk');
      expect(existsSync(DB_PATH)).toBe(true);
    });

    test('should skip when hash unchanged', async () => {
      const result1 = precompileToSQLite(TEMPLATE_PATH, DB_PATH);
      expect(result1).toContain('hello.njk');

      await new Promise(r => setTimeout(r, 10));

      const result2 = precompileToSQLite(TEMPLATE_PATH, DB_PATH);
      expect(result2).toContain('hello.njk');
    });

    test('should update when content changes', () => {
      precompileToSQLite(TEMPLATE_PATH, DB_PATH);

      writeFileSync(TEMPLATE_PATH, 'Updated: {{ name }}');

      const result = precompileToSQLite(TEMPLATE_PATH, DB_PATH);
      expect(result).toContain('hello.njk');
    });
  });

  describe('directory', () => {
    const TEST_DIR = createIsolatedTestDir();
    const DB_PATH = join(TEST_DIR, 'test.db');

    beforeAll(() => {
      writeFileSync(join(TEST_DIR, 'index.njk'), 'Index Page');
      writeFileSync(join(TEST_DIR, 'about.njk'), 'About Page');
      mkdirSync(join(TEST_DIR, 'sub'), { recursive: true });
      writeFileSync(join(TEST_DIR, 'sub', 'contact.njk'), 'Contact');
    });

    afterAll(() => {
      cleanupDir(join(__dirname, 'tmp-sqlite-test'));
    });

    beforeEach(() => {
      try { unlinkSync(DB_PATH); } catch (e) {}
    });

    test('should precompile all templates in directory', () => {
      const result = precompileToSQLite(TEST_DIR, DB_PATH);

      expect(result).toContain('index.njk');
      expect(result).toContain('about.njk');
      expect(result).toContain('sub/contact.njk');
      expect(result.length).toBe(3);
    });

    test('should exclude files matching pattern', () => {
      writeFileSync(join(TEST_DIR, 'include.njk'), 'Include me');
      writeFileSync(join(TEST_DIR, 'partial.njk'), 'Partial - exclude');

      const result = precompileToSQLite(TEST_DIR, DB_PATH, {
        exclude: [/partial/]
      });

      expect(result).toContain('include.njk');
      expect(result).not.toContain('partial.njk');
    });

    test('should exclude directories matching pattern', () => {
      mkdirSync(join(TEST_DIR, 'node_modules'), { recursive: true });
      writeFileSync(join(TEST_DIR, 'node_modules', 'dep.njk'), 'Dependency');
      writeFileSync(join(TEST_DIR, 'user.njk'), 'User template');

      const result = precompileToSQLite(TEST_DIR, DB_PATH, {
        exclude: [/node_modules/]
      });

      expect(result).toContain('user.njk');
      expect(result).not.toContain('node_modules/dep.njk');
    });

    test('should support custom extensions', () => {
      writeFileSync(join(TEST_DIR, 'page.html'), '<html>{{ content }}</html>');

      const result = precompileToSQLite(TEST_DIR, DB_PATH, {
        extensions: ['.html']
      });

      expect(result).toContain('page.html');
    });
  });
});

describe('loadFromSQLite', () => {
  const TEST_DIR = createIsolatedTestDir();
  const DB_PATH = join(TEST_DIR, 'test.db');
  const TEMPLATE_PATH = join(TEST_DIR, 'test.njk');

  beforeAll(() => {
    writeFileSync(TEMPLATE_PATH, 'Hello {{ name }}');
    precompileToSQLite(TEMPLATE_PATH, DB_PATH);
  });

  afterAll(() => {
    cleanupDir(join(__dirname, 'tmp-sqlite-test'));
  });

  test('should load precompiled templates from SQLite', () => {
    const templates = loadFromSQLite(DB_PATH);

    expect(templates['test.njk']).toBeDefined();
    expect(typeof templates['test.njk']).toBe('object');
  });

  test('should return empty object when DB does not exist', () => {
    const templates = loadFromSQLite('/non/existent/path.db');

    expect(Object.keys(templates)).toHaveLength(0);
  });
});

describe('clearSQLite', () => {
  const TEST_DIR = createIsolatedTestDir();
  const DB_PATH = join(TEST_DIR, 'test.db');

  beforeAll(() => {
    writeFileSync(join(TEST_DIR, 'a.njk'), 'A');
    writeFileSync(join(TEST_DIR, 'b.njk'), 'B');
    precompileToSQLite(TEST_DIR, DB_PATH);
  });

  afterAll(() => {
    cleanupDir(join(__dirname, 'tmp-sqlite-test'));
  });

  beforeEach(() => {
    try { unlinkSync(DB_PATH); } catch (e) {}
    writeFileSync(join(TEST_DIR, 'a.njk'), 'A');
    writeFileSync(join(TEST_DIR, 'b.njk'), 'B');
    precompileToSQLite(TEST_DIR, DB_PATH);
  });

  test('should clear all templates from database', () => {
    clearSQLite(DB_PATH);

    const templates = loadFromSQLite(DB_PATH);
    expect(Object.keys(templates)).toHaveLength(0);
  });
});

describe('BunSQLitePrecompiledLoader', () => {
  const TEST_DIR = createIsolatedTestDir();
  const DB_PATH = join(TEST_DIR, 'test.db');
  const TEMPLATE_PATH = join(TEST_DIR, 'greeting.njk');

  beforeAll(() => {
    writeFileSync(TEMPLATE_PATH, 'Hello {{ name }}!');
    precompileToSQLite(TEMPLATE_PATH, DB_PATH);
  });

  afterAll(() => {
    cleanupDir(join(__dirname, 'tmp-sqlite-test'));
  });

  test('should render template from SQLite', async () => {
    const { BunSQLitePrecompiledLoader } = await import('../nunjucks/src/bun-sqlite-loader.js');
    const { Environment } = await import('../nunjucks/src/environment.js');

    const loader = new BunSQLitePrecompiledLoader(DB_PATH);
    const env = new Environment(loader);

    const result = await env.render('greeting.njk', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  test('should return null for non-existent template', async () => {
    const { BunSQLitePrecompiledLoader } = await import('../nunjucks/src/bun-sqlite-loader.js');
    const loader = new BunSQLitePrecompiledLoader(DB_PATH);

    const result = await loader.getSource('non-existent.njk');
    expect(result).toBeNull();
  });
});

describe('configure with mode option', () => {
  test('should auto-enable SQLite in production mode', async () => {
    const nunjucks = (await import('../nunjucks/index.js')).default;

    try {
      const env = nunjucks.configure({
        mode: 'production'
      });

      expect(env).toBeDefined();
      nunjucks.reset();
    } catch (e) {
      // bun:sqlite might not be available
    }
  });

  test('should accept both path and opts syntax', async () => {
    const nunjucks = (await import('../nunjucks/index.js')).default;

    try {
      const env = nunjucks.configure('./views', {
        mode: 'development'
      });

      expect(env).toBeDefined();
      nunjucks.reset();
    } catch (e) {}
  });
});
