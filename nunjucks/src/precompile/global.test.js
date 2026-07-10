import { describe, test, expect } from 'bun:test';
import precompileGlobal from './global.js';

describe('precompileGlobal', () => {
  test('wraps single template in IIFE', () => {
    const result = precompileGlobal([
      { name: 'test.html', template: 'var x = 1;' },
    ]);
    expect(result).toContain('window.nunjucksPrecompiled');
    expect(result).toContain('"test.html"');
    expect(result).toContain('var x = 1;');
  });

  test('wraps multiple templates', () => {
    const result = precompileGlobal([
      { name: 'a.html', template: 'fn1' },
      { name: 'b.html', template: 'fn2' },
    ]);
    expect(result.match(/nunjucksPrecompiled/g).length).toBe(4);
  });

  test('includes asFunction wrapper when opts.asFunction is true', () => {
    const result = precompileGlobal([
      { name: 't.html', template: 'fn' },
    ], { asFunction: true });
    expect(result).toContain('async function(ctx)');
  });

  test('omits asFunction wrapper when not specified', () => {
    const result = precompileGlobal([
      { name: 't.html', template: 'fn' },
    ]);
    expect(result).not.toContain('async function(ctx)');
  });

  test('defaults opts to empty object', () => {
    const result = precompileGlobal([
      { name: 't.html', template: 'fn' },
    ]);
    expect(result).toBeDefined();
    expect(result).not.toContain('async function(ctx)');
  });
});
