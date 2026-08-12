import { makeComponent } from '@nunjucks/runtime';
import { normalize, preserveSafe } from './helpers.ts';
import type { StringFn, } from './types.ts';

const createStringFilter = (fn: StringFn) =>
  (value: unknown): string => {
    const normalizedValue = normalize(value, '');
    return preserveSafe(value, fn(normalizedValue));
  };

const createMacroFilter = <T extends unknown[]>(
  argNames: string[],
  fn: (...args: T) => unknown
) =>
  makeComponent({ argNames, kwargNames: [], func: fn });

export { createStringFilter, createMacroFilter };
