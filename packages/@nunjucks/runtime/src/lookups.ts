import { isArray, isIterable } from '@nunjucks/shared';

export const contextOrFrameLookup = (
  context: { lookup: (name: string) => unknown },
  frame: { lookup: (name: string) => unknown },
  name: string,
): unknown => {
  const value = frame.lookup(name);
  if (value === undefined) {
    return context.lookup(name);
  }
  return value;
};

export const fromIterator = (iterable: unknown): unknown => {
  if (typeof iterable !== 'object' || iterable === null || isArray(iterable)) {
    return iterable;
  }
  if (isIterable(iterable)) {
    return Array.from(iterable);
  }
  return iterable;
};
