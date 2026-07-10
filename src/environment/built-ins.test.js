import { describe, test, expect } from 'bun:test';
import { createBuiltIns, normalizeLoaders } from './built-ins.js';

describe('createBuiltIns', () => {
  test('returns an object with expected keys', () => {
    const result = createBuiltIns();
    expect(result).toHaveProperty('globals');
    expect(result).toHaveProperty('filters');
    expect(result).toHaveProperty('tests');
    expect(result).toHaveProperty('asyncFilters');
    expect(result).toHaveProperty('extensions');
    expect(result).toHaveProperty('extensionsList');
  });

  test('filters and tests start empty', () => {
    const result = createBuiltIns();
    expect(result.filters).toEqual({});
    expect(result.tests).toEqual({});
  });

  test('globals contains range, cycler, joiner', () => {
    const result = createBuiltIns();
    expect(result.globals).toHaveProperty('range');
    expect(result.globals).toHaveProperty('cycler');
    expect(result.globals).toHaveProperty('joiner');
  });
});

describe('normalizeLoaders', () => {
  test('returns empty array when no loaders and no constructors', () => {
    expect(normalizeLoaders(null)).toEqual([]);
    expect(normalizeLoaders(undefined)).toEqual([]);
  });

  test('returns array as-is when given array', () => {
    const loaders = [{ name: 'a' }, { name: 'b' }];
    const result = normalizeLoaders(loaders);
    expect(result).toBe(loaders);
  });

  test('wraps single loader in array', () => {
    const loader = { name: 'single' };
    expect(normalizeLoaders(loader)).toEqual([loader]);
  });
});
