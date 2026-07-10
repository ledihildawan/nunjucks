import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { precompileString, precompile } from './index.js';
import { Environment } from '../environment/index.js';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'njk-pc-'));
});

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

describe('precompileString', () => {
  test('throws if no name option', () => {
    expect(() => precompileString('Hello {{ name }}')).toThrow('name');
  });

  test('compiles a template string', () => {
    const result = precompileString('Hello {{ name }}', { name: 'hello.njk' });
    expect(result).toContain('hello.njk');
    expect(result).toContain('nunjucksPrecompiled');
  });

  test('accepts custom wrapper', () => {
    const customWrapper = (templates, opts) => {
      return templates.map(t => t.name).join(',');
    };
    const result = precompileString('Hello', { name: 'a.njk', wrapper: customWrapper });
    expect(result).toBe('a.njk');
  });

  test('accepts custom env', () => {
    const env = new Environment([]);
    const result = precompileString('{{ foo }}', { name: 'test.njk', env });
    expect(result).toContain('test.njk');
  });
});

describe('precompile', () => {
  test('compiles a single file', () => {
    writeFileSync(join(tmpDir, 't.njk'), 'Hello {{ name }}');
    const result = precompile(join(tmpDir, 't.njk'), { name: 'template.njk' });
    expect(result).toContain('template.njk');
    expect(result).toContain('nunjucksPrecompiled');
  });

  test('compiles a directory of templates', () => {
    writeFileSync(join(tmpDir, 'a.njk'), 'Template A');
    writeFileSync(join(tmpDir, 'b.njk'), 'Template B');

    const result = precompile(tmpDir, { include: [/\.njk$/] });

    expect(result).toContain('a.njk');
    expect(result).toContain('b.njk');
    expect(result).toContain('nunjucksPrecompiled');
  });

  test('respects include filter', () => {
    writeFileSync(join(tmpDir, 'keep.njk'), 'Keep me');
    writeFileSync(join(tmpDir, 'skip.txt'), 'Skip me');

    const result = precompile(tmpDir, { include: [/\.njk$/] });

    expect(result).toContain('keep.njk');
    expect(result).not.toContain('skip.txt');
  });

  test('respects exclude filter', () => {
    writeFileSync(join(tmpDir, 'main.njk'), 'Main');
    mkdirSync(join(tmpDir, 'node_modules'));
    writeFileSync(join(tmpDir, 'node_modules', 'lib.njk'), 'Lib');

    const result = precompile(tmpDir, {
      include: [/\.njk$/],
      exclude: [/node_modules/],
    });

    expect(result).toContain('main.njk');
    expect(result).not.toContain('lib.njk');
  });

  test('handles isString option', () => {
    const result = precompile('Hello {{ name }}', {
      isString: true,
      name: 'inline.njk',
    });
    expect(result).toContain('inline.njk');
  });

  test('throws on compile error without force', () => {
    writeFileSync(join(tmpDir, 'broken.njk'), '{% invalid');

    expect(() => precompile(tmpDir, { include: [/\.njk$/] })).toThrow();
  });

  test('continues on compile error with force', () => {
    writeFileSync(join(tmpDir, 'good.njk'), 'Hello');
    writeFileSync(join(tmpDir, 'broken.njk'), '{% invalid');

    const result = precompile(tmpDir, { include: [/\.njk$/], force: true });
    expect(result).toContain('good.njk');
  });
});
