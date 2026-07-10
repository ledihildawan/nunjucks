import { describe, test, expect } from 'bun:test';
import globals from './globals.js';

describe('range', () => {
  const { range } = globals();

  test('range(stop) generates 0 to stop-1', () => {
    expect(range(5)).toEqual([0, 1, 2, 3, 4]);
  });

  test('range(start, stop) generates start to stop-1', () => {
    expect(range(2, 6)).toEqual([2, 3, 4, 5]);
  });

  test('range(start, stop, step) with positive step', () => {
    expect(range(0, 10, 2)).toEqual([0, 2, 4, 6, 8]);
  });

  test('range(start, stop, step) with negative step', () => {
    expect(range(10, 0, -2)).toEqual([10, 8, 6, 4, 2]);
  });

  test('returns empty array for no iterations', () => {
    expect(range(0)).toEqual([]);
    expect(range(5, 3)).toEqual([]);
  });
});

describe('cycler', () => {
  const { cycler } = globals();

  test('cycles through items', () => {
    const c = cycler('a', 'b', 'c');
    expect(c.current).toBeNull();
    expect(c.next()).toBe('a');
    expect(c.current).toBe('a');
    expect(c.next()).toBe('b');
    expect(c.next()).toBe('c');
    expect(c.next()).toBe('a');
  });

  test('reset restarts cycler', () => {
    const c = cycler('x', 'y');
    c.next();
    c.next();
    c.reset();
    expect(c.current).toBeNull();
    expect(c.next()).toBe('x');
  });

  test('handles single item', () => {
    const c = cycler('only');
    expect(c.next()).toBe('only');
    expect(c.next()).toBe('only');
  });
});

describe('joiner', () => {
  const { joiner } = globals();

  test('returns empty string first time, then separator', () => {
    const sep = joiner(', ');
    expect(sep()).toBe('');
    expect(sep()).toBe(', ');
    expect(sep()).toBe(', ');
  });

  test('defaults to comma separator', () => {
    const sep = joiner();
    expect(sep()).toBe('');
    expect(sep()).toBe(',');
  });
});
