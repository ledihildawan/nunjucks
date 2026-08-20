import type { TemplateError } from '@nunjucks/error-formatter';
import { ok, type Result } from '@nunjucks/lib';
import { createComponent } from '@nunjucks/runtime';
import { normalize, preserveSafe } from './helpers.ts';
import type { SafeString, StringFn } from './types.ts';

/**
 * Wraps a string transform into a filter that normalizes the input to its
 * string form and carries the original's `safe` marking over to the result.
 */
const createStringFilter =
  (fn: StringFn) =>
  (value: unknown): Result<string | SafeString, TemplateError> => {
    const normalizedValue = normalize(value, '');
    return ok(preserveSafe(value, fn(normalizedValue)));
  };

// WHY: only R is generic — it propagates the implementation's return type (e.g. its Result
// shape) to the wrapped filter. The args tuple generic it previously carried was phantom
// (values are unknown end-to-end at the component boundary).
/** Wraps a positional-args implementation as a macro filter, binding its arg names to keyword-argument fallbacks. */
const createMacroFilter = <R>(argNames: string[], fn: (...args: unknown[]) => R) =>
  createComponent({ argNames, kwargNames: [], func: fn });

/**
 * Wraps an options-object implementation as a filter: the first arg name binds
 * positionally, the rest become kwargs, and the compiler's keywords envelope
 * arrives as one options record.
 *
 * WHY: the `opts as T` cast is the trust boundary — every filter implementation
 * re-validates its own option fields before use (matching the GlobalConfig pattern
 * where the factory validates top-level keys but not nested user-supplied data).
 * The cast is a TypeScript type-bridge: the filter function's typed `options: T`
 * receives the raw `Record<string, unknown>` after the compiler's keyword-envelope
 * has already been partitioned into typed key/value pairs at the call site.
 */
const createFilter = <T extends object, R>(argNames: string[], func: (options: T) => R) => {
  const wrapper = (opts: Record<string, unknown>) => func(opts as T);
  const firstName = argNames[0] ?? '';
  return createComponent({
    argNames: [firstName],
    kwargNames: argNames.slice(1),
    func: wrapper,
    optionsArg: true,
  });
};

export { createFilter, createMacroFilter, createStringFilter };
