import { describe, test, expect } from 'bun:test';
import { BLOCK_META_KEY, isCompiledTemplateExports } from './codegen-contract.ts';

describe('BLOCK_META_KEY', () => {
  test('is the canonical block metadata sentinel string', () => {
    expect(BLOCK_META_KEY).toBe('__blockMeta');
    expect(typeof BLOCK_META_KEY).toBe('string');
    expect(BLOCK_META_KEY.length).toBeGreaterThan(0);
  });
});

describe('isCompiledTemplateExports', () => {
  const asyncGeneratorFunction = async function* (): AsyncGenerator<string, unknown> {
    yield 'chunk';
    return {};
  };

  const regularFunction = (): unknown => undefined;

  const validCases: ReadonlyArray<{ name: string; value: unknown }> = [
    { name: 'object with an async-generator root', value: { root: asyncGeneratorFunction } },
    { name: 'object with a regular-function root', value: { root: regularFunction } },
    {
      name: 'object with root plus block functions and block metadata',
      value: { root: asyncGeneratorFunction, content: asyncGeneratorFunction, [BLOCK_META_KEY]: { order: ['content'] } },
    },
    { name: 'object with an arrow-function root', value: { root: () => undefined } },
  ];

  const invalidCases: ReadonlyArray<{ name: string; value: unknown }> = [
    { name: 'null', value: null },
    { name: 'undefined', value: undefined },
    { name: 'number primitive', value: 42 },
    { name: 'string primitive', value: 'template' },
    { name: 'boolean primitive', value: true },
    { name: 'plain object without root', value: { content: regularFunction } },
    { name: 'object with non-function root (string)', value: { root: 'not-a-function' } },
    { name: 'object with non-function root (object)', value: { root: { chunk: 'x' } } },
    { name: 'object with non-function root (null)', value: { root: null } },
    { name: 'object with non-function root (undefined)', value: { root: undefined } },
    { name: 'empty array', value: [] },
    { name: 'array with a root-like entry', value: [regularFunction] },
    { name: 'Date instance', value: new Date() },
    { name: 'Map instance', value: new Map() },
  ];

  test.each(validCases.map(({ name, value }) => [name, value] as const))(
    'returns true for %s',
    (_name, value) => {
      expect(isCompiledTemplateExports(value)).toBe(true);
    },
  );

  test.each(invalidCases.map(({ name, value }) => [name, value] as const))(
    'returns false for %s',
    (_name, value) => {
      expect(isCompiledTemplateExports(value)).toBe(false);
    },
  );

  test('narrows the type so root is callable after a successful guard', () => {
    const value: unknown = { root: regularFunction };
    if (isCompiledTemplateExports(value)) {
      expect(typeof value.root).toBe('function');
      expect(() => value.root(undefined, undefined, undefined, undefined)).not.toThrow();
    } else {
      throw new Error('expected isCompiledTemplateExports to be true');
    }
  });

  test('forEach-driven functional assertion across the whole valid set', () => {
    validCases.forEach(({ value }) => {
      expect(isCompiledTemplateExports(value)).toBe(true);
    });
    invalidCases.forEach(({ value }) => {
      expect(isCompiledTemplateExports(value)).toBe(false);
    });
  });
});
