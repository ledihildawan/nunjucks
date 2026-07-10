import { describe, test, expect } from 'bun:test';
import { createLoader } from './base.js';
import { resolve, dirname, sep } from 'node:path';

describe('createLoader', () => {
  test('isRelative returns true for ./ paths', () => {
    const loader = createLoader();
    expect(loader.isRelative('./foo.njk')).toBe(true);
  });

  test('isRelative returns true for ../ paths', () => {
    const loader = createLoader();
    expect(loader.isRelative('../foo.njk')).toBe(true);
  });

  test('isRelative returns false for absolute paths', () => {
    const loader = createLoader();
    const abs = sep === '/' ? '/foo.njk' : 'C:\\foo.njk';
    expect(loader.isRelative(abs)).toBe(false);
  });

  test('isRelative returns false for plain names', () => {
    const loader = createLoader();
    expect(loader.isRelative('foo.njk')).toBe(false);
  });

  test('resolve uses dirname of from', () => {
    const loader = createLoader();
    const result = loader.resolve('/templates/base.njk', 'child.njk');
    expect(result).toBe(resolve(dirname('/templates/base.njk'), 'child.njk'));
  });

  test('resolve handles relative child paths', () => {
    const loader = createLoader();
    const result = loader.resolve('/templates/base.njk', './child.njk');
    expect(result).toBe(resolve(dirname('/templates/base.njk'), './child.njk'));
  });
});
