import type { TemplateError } from '@nunjucks/error-formatter';
import { ok, type Result } from '@nunjucks/lib';
import { createComponent } from '@nunjucks/runtime';
import { normalize, preserveSafe } from './helpers.ts';
import type { StringFn } from './types.ts';

const createStringFilter =
  (fn: StringFn) =>
  (value: unknown): Result<string, TemplateError> => {
    const normalizedValue = normalize(value, '');
    return ok(preserveSafe(value, fn(normalizedValue)));
  };

// WHY: only R is generic — it propagates the implementation's return type (e.g. its Result
// shape) to the wrapped filter. The args tuple generic it previously carried was phantom
// (values are unknown end-to-end at the component boundary).
const createMacroFilter = <R>(argNames: string[], fn: (...args: unknown[]) => R) =>
  createComponent({ argNames, kwargNames: [], func: fn });

const createFilter = <T extends object, R>(argNames: string[], func: (options: T) => R) => {
  const wrapper = (opts: Record<string, unknown>) => func(opts as T);
  const firstName = argNames[0] ?? '';
  return createComponent({
    argNames: [firstName],
    kwargNames: argNames.slice(1),
    func: wrapper as (opts: Record<string, unknown>) => R,
    optionsArg: true,
  });
};

export { createFilter, createMacroFilter, createStringFilter };
