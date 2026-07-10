import { describe, test, expect } from 'bun:test';
import Loader from './base.js';
import { resolve, dirname, sep } from 'node:path';

describe('Loader', () => {
  test('isRelative returns true for ./ paths', () => {
    const loader = new Loader();
    expect(loader.isRelative('./foo.njk')).toBe(true);
  });

  test('isRelative returns true for ../ paths', () => {
    const loader = new Loader();
    expect(loader.isRelative('../foo.njk')).toBe(true);
  });

  test('isRelative returns false for absolute paths', () => {
    const loader = new Loader();
    const abs = sep === '/' ? '/foo.njk' : 'C:\\foo.njk';
    expect(loader.isRelative(abs)).toBe(false);
  });

  test('isRelative returns false for plain names', () => {
    const loader = new Loader();
    expect(loader.isRelative('foo.njk')).toBe(false);
  });

  test('resolve uses dirname of from', () => {
    const loader = new Loader();
    const result = loader.resolve('/templates/base.njk', 'child.njk');
    expect(result).toBe(resolve(dirname('/templates/base.njk'), 'child.njk'));
  });

  test('resolve handles relative child paths', () => {
    const loader = new Loader();
    const result = loader.resolve('/templates/base.njk', './child.njk');
    expect(result).toBe(resolve(dirname('/templates/base.njk'), './child.njk'));
  });
});
