import { makeMacro } from '@nunjucks/runtime';
import { normalize, preserveSafe } from './core.ts';
import type { StringFn, } from './types.ts';

const createStringFilter = (fn: StringFn) =>
  (value: unknown): unknown => {
    const s = normalize(value, '');
    return preserveSafe(value, fn(s));
  };

const createStringFilterWithArgs = <A extends unknown[]>(
  fn: (s: string, ...args: A) => string,
  defaultArgs: A
) =>
  (value: unknown, ...args: A): unknown => {
    const s = normalize(value, '');
    let mergedArgs: A;
    if (args.length > 0) {
      mergedArgs = args;
    } else {
      mergedArgs = defaultArgs;
    }
    return preserveSafe(value, fn(s, ...mergedArgs));
  };

/**
 * A curried filter implementation: takes the filter's own arguments and
 * returns the function that finally receives the piped value.
 * `never[]` in parameter position accepts any concrete argument list.
 */
type CurriedFilter = (...args: never[]) => (value: unknown) => unknown;

const createFilter = <T extends CurriedFilter>(fn: T) =>
  (value: unknown, ...args: Parameters<T>) => fn(...args)(value);

const createMacroFilter = <T extends unknown[]>(
  argNames: string[],
  fn: (...args: T) => unknown
) =>
  makeMacro(argNames, [], fn as (...args: T) => unknown);

const createConditionalMacro = (
  condition: (value: unknown) => boolean,
  truthyFn: (value: unknown) => unknown,
  falsyFn: (value: unknown) => unknown = (v) => v
) =>
  createMacroFilter(['value'], (value: unknown) => {
    if (condition(value)) {
      return truthyFn(value);
    }
    return falsyFn(value);
  });

export { createStringFilter, createStringFilterWithArgs, createFilter, createMacroFilter, createConditionalMacro };
