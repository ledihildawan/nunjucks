import { isArray, isIterable } from './type-guards.ts';

export const fromIterator = (iterable: unknown): unknown => {
  if (typeof iterable !== 'object' || iterable === null || isArray(iterable)) {
    return iterable;
  }
  if (isIterable(iterable)) {
    return Array.from(iterable);
  }
  return iterable;
};
