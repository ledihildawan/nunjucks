import { isArray, isIterable } from './type-guards.ts';

/**
 * Normalizes an iterable into an array: non-array iterables are materialized
 * via `Array.from`, while arrays, primitives, `null`, and plain objects pass
 * through unchanged.
 */
export const fromIterator = (iterable: unknown): unknown => {
  if (typeof iterable !== 'object' || iterable === null || isArray(iterable)) {
    return iterable;
  }
  if (isIterable(iterable)) {
    return Array.from(iterable);
  }
  return iterable;
};
