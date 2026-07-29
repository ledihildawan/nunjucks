import { makeMacro } from '@nunjucks/runtime';
import { normalize, preserveSafe } from './core.ts';
import type { StringFn, } from './types.ts';

const createStringFilter = (fn: StringFn) =>
  (value: unknown): unknown => {
    const s = normalize(value, '');
    return preserveSafe(value, fn(s));
  };

const createMacroFilter = <T extends unknown[]>(
  argNames: string[],
  fn: (...args: T) => unknown
) =>
  makeMacro(argNames, [], fn as (...args: T) => unknown);

export { createStringFilter, createMacroFilter };
