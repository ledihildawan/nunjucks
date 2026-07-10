import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Template } from './index.js';
import { Environment } from '../environment/index.js';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'njk-tpl-'));
});

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

describe('Template constructor', () => {
  test('accepts string src', () => {
    const env = new Environment([]);
    const t = new Template('Hello {{ name }}', env);
    expect(t.tmplStr).toBe('Hello {{ name }}');
    expect(t.compiled).toBe(false);
  });

  test('accepts object src with type string', () => {
    const env = new Environment([]);
    const t = new Template({ type: 'string', obj: 'Hello' }, env);
    expect(t.tmplStr).toBe('Hello');
  });

  test('accepts object src with type code', () => {
    const env = new Environment([]);
    const t = new Template({ type: 'code', obj: { root: () => {} } }, env);
    expect(t.tmplProps).toEqual({ root: expect.any(Function) });
  });

  test('throws on invalid src type', () => {
    const env = new Environment([]);
    expect(() => new Template(123, env)).toThrow('src must be a string');
  });

  test('throws on unexpected object type', () => {
    const env = new Environment([]);
    expect(() => new Template({ type: 'invalid', obj: {} }, env)).toThrow('Unexpected template object type');
  });

  test('sets path', () => {
    const env = new Environment([]);
    const t = new Template('Hello', env, '/templates/test.njk');
    expect(t.path).toBe('/templates/test.njk');
  });

  test('uses fallback env when env is null', () => {
    const t = new Template('Hello {{ name }}', null);
    expect(t.env.opts).toBeDefined();
    expect(t.env.asyncFilters).toEqual([]);
    expect(t.env.extensionsList).toEqual([]);
  });

  test('eagerCompile compiles immediately', () => {
    const env = new Environment([]);
    const t = new Template('Hello', env, 'test.njk', true);
    expect(t.compiled).toBe(true);
    expect(t.rootRenderFunc).toBeFunction();
  });

  test('throws on compile error with eagerCompile', () => {
    const env = new Environment([]);
    expect(() => new Template('{% bad syntax %}', env, 'bad.njk', true)).toThrow();
  });
});

describe('Template compile', () => {
  test('compile() compiles lazily', async () => {
    const env = new Environment([]);
    const t = new Template('Hello', env);
    expect(t.compiled).toBe(false);
    await t.compile();
    expect(t.compiled).toBe(true);
    expect(t.rootRenderFunc).toBeFunction();
  });

  test('compile() is idempotent', async () => {
    const env = new Environment([]);
    const t = new Template('Hello', env);
    await t.compile();
    const fn1 = t.rootRenderFunc;
    await t.compile();
    expect(t.rootRenderFunc).toBe(fn1);
  });

  test('compile() throws on invalid syntax', async () => {
    const env = new Environment([]);
    const t = new Template('{% if %}', env);
    await expect(t.compile()).rejects.toThrow();
  });
});

describe('Template render', () => {
  test('renders plain text', async () => {
    const env = new Environment([]);
    const t = new Template('Hello world', env, 'test.njk', true);
    const result = await t.render();
    expect(result).toBe('Hello world');
  });

  test('renders with context', async () => {
    const env = new Environment([]);
    const t = new Template('Hello {{ name }}', env, 'test.njk', true);
    const result = await t.render({ name: 'World' });
    expect(result).toBe('Hello World');
  });

  test('renders with for loop', async () => {
    const env = new Environment([]);
    const t = new Template('{% for x in items %}{{ x }},{% endfor %}', env, 'test.njk', true);
    const result = await t.render({ items: [1, 2, 3] });
    expect(result).toBe('1,2,3,');
  });

  test('renders with if block', async () => {
    const env = new Environment([]);
    const t = new Template('{% if show %}yes{% endif %}', env, 'test.njk', true);
    expect(await t.render({ show: true })).toBe('yes');
    expect(await t.render({ show: false })).toBe('');
  });

  test('renders with set block', async () => {
    const env = new Environment([]);
    const t = new Template('{% set x = 42 %}{{ x }}', env, 'test.njk', true);
    const result = await t.render();
    expect(result).toBe('42');
  });

  test('renders block inheritance', async () => {
    const env = new Environment([]);
    const t = new Template('{% block content %}child{% endblock %}', env, 'child.njk', true);
    const result = await t.render();
    expect(result).toBe('child');
  });

  test('throws on circular include', async () => {
    const env = new Environment([]);
    env._renderingTemplates.add('circular.njk');
    const t = new Template('Hello', env, 'circular.njk', true);
    await expect(t.render()).rejects.toThrow('Circular include detected');
  });

  test('parentFrame is used', async () => {
    const env = new Environment([]);
    const t = new Template('{{ x }}', env, 'test.njk', true);
    const { Frame } = await import('../runtime/index.js');
    const frame = new Frame();
    frame.set('x', 42);
    const result = await t.render({}, frame);
    expect(result).toBe('42');
  });
});

describe('Template getExported', () => {
  test('exports template variables', async () => {
    const env = new Environment([]);
    const t = new Template('{% set foo = "bar" %}{% set exported = "yes" %}', env, 'test.njk', true);
    const exported = await t.getExported({});
    expect(exported).toBeDefined();
  });
});

describe('Template _getBlocks', () => {
  test('extracts block functions', () => {
    const env = new Environment([]);
    const t = new Template('Hello', env);
    const props = {};
    const blockFn = () => {};
    props.b_header = blockFn;
    props.root = () => {};
    const blocks = t._getBlocks(props);
    expect(blocks.header).toBe(blockFn);
    expect(Object.keys(blocks)).toEqual(['header']);
  });
});

describe('Template _enrichError', () => {
  test('sets path on error', () => {
    const env = new Environment([]);
    const t = new Template('Hello', env, 'test.njk', true);
    const err = new Error('test error');
    const enriched = t._enrichError(err);
    expect(enriched.path).toBe('test.njk');
  });

  test('preserves existing path', () => {
    const env = new Environment([]);
    const t = new Template('Hello', env, 'test.njk', true);
    const err = new Error('test error');
    err.path = 'original.njk';
    const enriched = t._enrichError(err);
    expect(enriched.path).toBe('original.njk');
  });
});
