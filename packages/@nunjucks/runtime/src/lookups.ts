import { isArray, isIterable } from '@nunjucks/shared';

function contextOrFrameLookup(
  context: { lookup: (name: string) => unknown },
  frame: { lookup: (name: string) => unknown },
  name: string,
): unknown {
  const value = frame.lookup(name);
  if (value === undefined) {
    return context.lookup(name);
  }
  return value;
}

function fromIterator(arr: unknown): unknown {
  if (typeof arr !== 'object' || arr === null || isArray(arr)) {
    return arr;
  }
  if (isIterable(arr)) {
    return Array.from(arr);
  }
  return arr;
}

export { contextOrFrameLookup, fromIterator };
