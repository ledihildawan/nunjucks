import { describe, expect, test } from 'bun:test';
import { createLoader, LoaderSymbol } from './base.ts';

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
});
