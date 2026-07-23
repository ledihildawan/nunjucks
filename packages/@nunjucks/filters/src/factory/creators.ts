import { makeMacro } from '@nunjucks/runtime';
import { normalize, preserveSafe } from './core.ts';
import type { StringFn, FilterContext } from './types.ts';

export const createStringFilter = (fn: StringFn) =>
  (value: unknown): unknown => {
    const s = normalize(value, '');
    return preserveSafe(value, fn(s));
  };

export const createStringFilterWithArgs = <A extends unknown[]>(
  fn: (s: string, ...args: A) => string,
  defaultArgs: A
) =>
  (value: unknown, ...args: A): unknown => {
    const s = normalize(value, '');
    const mergedArgs = args.length > 0 ? args : defaultArgs;
    return preserveSafe(value, fn(s, ...mergedArgs));
  };

export const createFilter = <T extends (...args: any[]) => any>(fn: T) =>
  (value: unknown, ...args: Parameters<T>) => fn(...args)(value);

export const createMacroFilter = <T extends unknown[]>(
  argNames: string[],
  fn: (...args: T) => unknown
) =>
  makeMacro(argNames, [], fn as (...args: T) => unknown);

export const createConditionalMacro = (
  condition: (value: unknown) => boolean,
  truthyFn: (value: unknown) => unknown,
  falsyFn: (value: unknown) => unknown = (v) => v
) =>
  createMacroFilter(['value'], (value: unknown) =>
    condition(value) ? truthyFn(value) : falsyFn(value)
  );
