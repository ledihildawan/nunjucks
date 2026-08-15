import { describe, expect, test } from 'bun:test';
import { BLOCK_META_KEY, extractBlocks, isCompiledTemplateExports } from './compiled-template.ts';

describe('BLOCK_META_KEY', () => {
  test('is a stable string constant', () => {
    expect(BLOCK_META_KEY).toBe('__blockMeta');
  });
});

describe('isCompiledTemplateExports', () => {
  test('accepts exports with a root render function', () => {
    const value = {
      root: async function* root(): AsyncGenerator<string, unknown> {
        yield '';
        return undefined;
      },
    };
    expect(isCompiledTemplateExports(value)).toBe(true);
  });

  test('rejects values without a root function', () => {
    expect(isCompiledTemplateExports({})).toBe(false);
    expect(isCompiledTemplateExports({ root: 'not a function' })).toBe(false);
    expect(isCompiledTemplateExports(null)).toBe(false);
    expect(isCompiledTemplateExports(undefined)).toBe(false);
  });
});

describe('extractBlocks', () => {
  test('keeps only b_-prefixed keys, stripping the prefix', () => {
    const result = extractBlocks({ b_title: 1, b_footer: 2, other: 3 });
    expect(result).toEqual({ title: 1, footer: 2 });
  });

  test('ignores keys that merely contain the prefix', () => {
    const result = extractBlocks({ notb_x: 1, b_: 2, b_a: 3 });
    expect(result).toEqual({ '': 2, a: 3 });
  });

  test('returns an empty object when nothing matches', () => {
    expect(extractBlocks({ a: 1, b: 2 })).toEqual({});
  });

  test('preserves the matched values unchanged', () => {
    const fn = () => 0;
    const result = extractBlocks({ b_fn: fn, b_obj: { nested: true } });
    expect(result.fn).toBe(fn);
    expect(result.obj).toEqual({ nested: true });
  });
});
