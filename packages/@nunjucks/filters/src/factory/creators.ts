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

const createFilter = <T extends object, R>(
  argNames: string[],
  func: (options: T) => R
) => {
  const wrapper = (opts: Record<string, unknown>) => func(opts as T);
  const firstName = argNames[0] ?? '';
  return makeComponent({ argNames: [firstName], kwargNames: argNames.slice(1), func: wrapper as (opts: Record<string, unknown>) => R, optionsArg: true });
};

export { createStringFilter, createMacroFilter, createFilter };
