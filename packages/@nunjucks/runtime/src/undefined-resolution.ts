import { isNonNullish } from '@nunjucks/lib';
import { DEFAULT_UNDEFINED_MODE, type UndefinedMode } from '@nunjucks/shared';
import { getLogContext } from './error-context.ts';
import { isNullAccessResult, isPropertyNotFoundResult } from './member-access.ts';
import {
  type ResolveUndefinedOptions,
  resolveNullAccess,
  resolveUndefinedProperty,
  resolveUndefinedValue,
} from './undefined-rules.ts';

/** Options for `ensureDefined`: source position, variable name, and undefined mode. */
export interface EnsureDefinedOptions {
  lineno?: number | null;
  colno?: number | null;
  varName?: string | null;
  // WHY: widened to the full UndefinedMode — the compiler threads the user-facing
  // 'default' mode into this emitted-code channel verbatim; only 'strict' and 'debug'
  // have resolver behavior, every other value falls through to the undefined string.
  undefinedMode?: UndefinedMode;
}

/**
 * Resolves a value against the undefined mode: routes miss sentinels
 * (not-found callables, null-access objects) and raw nullish values through
 * the mode's rule — `'undefined'` string, warning, or throw — and passes
 * defined values through untouched.
 *
 * @param this - Runtime context carrying template name and phase.
 * @param value - The value to resolve.
 * @param options - Source position, variable name, and undefined mode.
 * @returns The resolved value, `'undefined'` string, or throws in strict mode.
 * @throws {Error} In strict mode when value is nullish or a miss sentinel.
 */
export function ensureDefined(
  this: unknown,
  value: unknown,
  options: EnsureDefinedOptions = {}
): unknown {
  const { lineno, colno, varName = null, undefinedMode = DEFAULT_UNDEFINED_MODE } = options;
  if (isPropertyNotFoundResult(value) || isNullAccessResult(value)) {
    const ctx = getLogContext(this);
    const effectiveTemplateName = ctx.templateName ?? 'inline';
    const resolveOptions: ResolveUndefinedOptions = {
      runtimeContext: this,
      subjectValue: value,
      varName,
      lineno,
      colno,
      mode: undefinedMode,
      phase: ctx.phase ?? 'render',
      templateName: effectiveTemplateName,
    };
    if (isPropertyNotFoundResult(value)) {
      return resolveUndefinedProperty(value, resolveOptions);
    }
    return resolveNullAccess(value, resolveOptions);
  }

  if (!isNonNullish(value)) {
    const ctx = getLogContext(this);
    const effectiveTemplateName = ctx.templateName ?? 'inline';
    return resolveUndefinedValue({
      runtimeContext: this,
      subjectValue: value,
      varName,
      lineno,
      colno,
      mode: undefinedMode,
      phase: ctx.phase ?? 'render',
      templateName: effectiveTemplateName,
    });
  }

  return value;
}
