import { describe, test, expect, beforeEach } from 'bun:test';
import { createEnvironment } from './index.js';
import { createTemplate } from '../template/index.js';

let env;

beforeEach(() => {
  env = createEnvironment([]);
});

describe('Environment constructor', () => {
  test('init sets default opts', () => {
    expect(env.opts.autoescape).toBe(true);
    expect(env.opts.dev).toBe(false);
    expect(env.opts.version).toBe('3.2.4');
    expect(env.opts.undefined).toBe('chainable');
    expect(env.opts.trimBlocks).toBe(false);
    expect(env.opts.lstripBlocks).toBe(false);
    expect(env.opts.ide).toBe('vscode');
  });

  test('init merges custom opts', () => {
    const custom = createEnvironment([], { dev: true, autoescape: false });
    expect(custom.opts.dev).toBe(true);
    expect(custom.opts.autoescape).toBe(false);
  });

  test('init sets _renderingTemplates', () => {
    expect(env._renderingTemplates).toBeInstanceOf(Set);
    expect(env._renderingTemplates.size).toBe(0);
  });

  test('init normalizes loaders', () => {
    expect(env.loaders).toBeArray();
  });

  test('registers built-ins', () => {
    expect(env.filters).toBeDefined();
    expect(env.tests).toBeDefined();
    expect(env.globals).toBeDefined();
    expect(env.extensions).toBeDefined();
    expect(env.extensionsList).toBeDefined();
  });

  test('accepts a single loader', () => {
    const loader = { getSource: () => ({ src: 'Hello', path: 'test.njk' }) };
    const e = createEnvironment(loader);
    expect(e.loaders).toBeArray();
  });
});

describe('invalidateCache', () => {
  test('clears all loader caches', () => {
    env.loaders.forEach(l => { l.cache = { key: 'value' }; });
    env.invalidateCache();
    env.loaders.forEach(l => expect(l.cache).toEqual({}));
  });
});

describe('extensions', () => {
  const ext = { tags: ['custom'], parse: () => null };

  test('addExtension stores extension', () => {
    env.addExtension('custom', ext);
    expect(env.getExtension('custom')).toBe(ext);
    expect(env.hasExtension('custom')).toBe(true);
    expect(env.extensionsList).toContain(ext);
  });

  test('addExtension sets __name', () => {
    env.addExtension('custom', ext);
    expect(ext.__name).toBe('custom');
  });

  test('addExtension returns this', () => {
    expect(env.addExtension('c', ext)).toBe(env);
  });

  test('removeExtension removes extension', () => {
    env.addExtension('custom', ext);
    env.removeExtension('custom');
    expect(env.hasExtension('custom')).toBe(false);
    expect(env.extensionsList).not.toContain(ext);
  });

  test('removeExtension does nothing for unknown', () => {
    env.removeExtension('nonexistent');
    expect(env.extensionsList.length).toBe(0);
  });

  test('getExtension returns undefined for unknown', () => {
    expect(env.getExtension('unknown')).toBeUndefined();
  });

  test('hasExtension returns false for unknown', () => {
    expect(env.hasExtension('unknown')).toBe(false);
  });
});

describe('globals', () => {
  test('addGlobal stores value', () => {
    env.addGlobal('myvar', 42);
    expect(env.globals.myvar).toBe(42);
  });

  test('addGlobal returns this', () => {
    expect(env.addGlobal('x', 1)).toBe(env);
  });

  test('getGlobal returns value', () => {
    env.addGlobal('myvar', 'hello');
    expect(env.getGlobal('myvar')).toBe('hello');
  });

  test('getGlobal throws for missing global', () => {
    expect(() => env.getGlobal('nonexistent')).toThrow('global not found');
  });

  test('getGlobal error has code and subject', () => {
    try { env.getGlobal('missing'); } catch (e) {
      expect(e.code).toBe('GLOBAL_NOT_FOUND');
      expect(e.subject).toBe('missing');
    }
  });
});

describe('filters', () => {
  test('addFilter stores filter', () => {
    const fn = (x) => x;
    env.addFilter('myfilter', fn);
    expect(env.filters.myfilter).toBe(fn);
  });

  test('addFilter returns this', () => {
    expect(env.addFilter('f', (x) => x)).toBe(env);
  });

  test('getFilter returns wrapped async filter', () => {
    env.addFilter('upper', (x) => String(x).toUpperCase());
    const filter = env.getFilter('upper');
    expect(filter).toBeFunction();
  });

  test('getFilter throws for missing filter', () => {
    expect(() => env.getFilter('nonexistent')).toThrow('filter not found');
  });

  test('getFilter error has code UNDEFINED_FILTER', () => {
    try { env.getFilter('missing'); } catch (e) {
      expect(e.code).toBe('UNDEFINED_FILTER');
    }
  });
});

describe('tests', () => {
  test('addTest stores test', () => {
    const fn = (x) => x === 42;
    env.addTest('is42', fn);
    expect(env.tests.is42).toBe(fn);
  });

  test('addTest returns this', () => {
    expect(env.addTest('t', () => true)).toBe(env);
  });

  test('getTest returns test', () => {
    env.addTest('even', (x) => x % 2 === 0);
    expect(env.getTest('even')).toBeFunction();
  });

  test('getTest throws for missing test', () => {
    expect(() => env.getTest('nonexistent')).toThrow('test not found');
  });
});

describe('getTemplate', () => {
  test('returns template from precompiled loader', async () => {
    const loader = { getSource: () => ({ src: 'Hello', path: 'test.njk' }) };
    const e = createEnvironment(loader);
    const tmpl = await e.getTemplate('test', false);
    expect(tmpl.typename).toBe('Template');
  });

  test('returns noop template when ignoreMissing', async () => {
    const tmpl = await env.getTemplate('nonexistent', false, null, true);
    expect(tmpl.typename).toBe('Template');
  });

  test('throws FILE_NOT_FOUND when ignoreMissing is false', async () => {
    await expect(env.getTemplate('nonexistent')).rejects.toThrow('template not found');
  });
});

describe('resolveTemplate', () => {
  test('delegates to resolveTemplatePath', () => {
    const loader = {};
    const result = env.resolveTemplate(loader, null, './test.njk');
    expect(result).toBe('./test.njk');
  });
});

describe('render and renderString', () => {
  test('renderString compiles and renders', async () => {
    const result = await env.renderString('Hello {{ name }}', { name: 'World' });
    expect(result).toBe('Hello World');
  });

  test('renderString with path option', async () => {
    const result = await env.renderString('Hello', {}, { path: 'test.njk' });
    expect(result).toBe('Hello');
  });
});

describe('express', () => {
  test('returns environment and sets up app', () => {
    const app = { set() {}, get() {}, use() {} };
    const result = env.express(app);
    expect(result).toBe(env);
  });
});

describe('getErrorFormatter', () => {
  test('creates and caches error formatter', () => {
    const f1 = env.getErrorFormatter();
    const f2 = env.getErrorFormatter();
    expect(f1).toBe(f2);
    expect(f1.formatError).toBeFunction();
  });
});

describe('formatError', () => {
  test('formats an error', async () => {
    const result = await env.formatError(new Error('test'), 'template.njk');
    expect(result).toBeObject();
    expect(result.name).toBe('NunjucksError');
    expect(result.message).toBe('test');
  });
});
