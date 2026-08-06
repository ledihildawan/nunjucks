import { describe, test, expect } from 'bun:test';
import { createLoader, isLoader, LoaderSymbol } from './base.ts';

describe('loaders/base', () => {
  describe('createLoader', () => {
    test('creates a loader with LoaderSymbol', () => {
      const loader = createLoader();
      expect(loader[LoaderSymbol]).toBe(true);
    });

    test('loader has on and emit methods', () => {
      const loader = createLoader();
      expect(typeof loader.on).toBe('function');
      expect(typeof loader.emit).toBe('function');
    });

    test('on and emit are hooked together', () => {
      const loader = createLoader();
      let called = false;
      let calledWith: unknown[] = [];
      loader.on('test', (...args: unknown[]) => {
        called = true;
        calledWith = args;
      });
      loader.emit('test', 1, 2);
      expect(called).toBe(true);
      expect(calledWith).toEqual([1, 2]);
    });
  });

  describe('isLoader', () => {
    test('returns true for a loader from createLoader', () => {
      const loader = createLoader();
      expect(isLoader(loader)).toBe(true);
    });

    test('returns false for a plain object', () => {
      expect(isLoader({})).toBe(false);
    });

    test('returns false for null', () => {
      expect(isLoader(null)).toBe(false);
    });

    test('returns false for undefined', () => {
      expect(isLoader(undefined)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(isLoader('loader')).toBe(false);
    });

    test('returns true for an object with LoaderSymbol', () => {
      const obj = { [LoaderSymbol]: true, on: () => {}, emit: () => {} };
      expect(isLoader(obj)).toBe(true);
    });

    test('returns true for an object with LoaderSymbol and correct methods', () => {
      const obj = {
        [LoaderSymbol]: true,
        on: () => {},
        emit: () => {},
      };
      expect(isLoader(obj)).toBe(true);
    });
  });
});
