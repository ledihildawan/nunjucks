import { makeComponent } from '@nunjucks/runtime';
import { normalize, preserveSafe } from './core.ts';
import type { StringFn, } from './types.ts';

const createStringFilter = (fn: StringFn) =>
  (value: unknown): string => {
    const s = normalize(value, '');
    return preserveSafe(value, fn(s));
  };

const createMacroFilter = <T extends unknown[]>(
  argNames: string[],
  fn: (...args: T) => unknown
) =>
  makeComponent(argNames, [], fn as (...args: T) => unknown);

export { createStringFilter, createMacroFilter };
