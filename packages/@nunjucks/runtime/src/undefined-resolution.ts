import { isNonNullish } from '@nunjucks/lib';
import { DEFAULT_UNDEFINED_MODE, type HandledUndefinedMode } from '@nunjucks/shared';
import { getLogContext } from './error-context.ts';
import { isNullAccessResult, isPropertyNotFoundResult } from './member-access.ts';
import {
  type ResolveUndefinedOptions,
  resolveNullAccess,
  resolveUndefinedProperty,
  resolveUndefinedValue,
} from './undefined-rules.ts';

export interface EnsureDefinedOptions {
  lineno?: number | null;
  colno?: number | null;
  varName?: string | null;
  undefinedMode?: HandledUndefinedMode;
}

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
