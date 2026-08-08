import { createLog, ERROR_DEFINITIONS, type ErrorDefinitionEntry, type WarningContext } from '@nunjucks/log';
import { isNonNullish, MATCH_ANY_RE } from '@nunjucks/shared';
import { isNullAccessResult, isPropertyNotFoundResult, type PropertyNotFoundResult, type NullAccessResult } from './member-access.ts';
import { getLogContext, throwRuntimeError } from './log-context.ts';

interface ResolveUndefinedOptions {
  self: unknown;
  val: unknown;
  varName: string | null;
  lineno?: number | null;
  colno?: number | null;
  mode: 'chainable' | 'strict' | 'debug';
  phase: string;
  templateName: string;
}

interface EmitUndefinedWarningOptions {
  name: string;
  message: () => string;
  subject: string | null;
  lineno?: number | null;
  colno?: number | null;
  phase: string;
  templateName: string;
  mode: 'chainable' | 'strict' | 'debug';
  varName: string | null;
}

const emitUndefinedWarning = (self: unknown, options: EmitUndefinedWarningOptions): void => {
  const warning = createLog(
    'warning',
    {
      name: options.name,
      message: options.message,
      pattern: MATCH_ANY_RE,
    },
    {},
    options.subject,
    {
      lineno: options.lineno ?? null,
      colno: options.colno ?? null,
      phase: options.phase,
      templateName: options.templateName,
      undefinedMode: options.mode,
      varName: options.varName,
      lineBase: 'zero',
    } as WarningContext,
  );
  const collector = self && typeof self === 'object'
    ? (self as { __warnings__?: unknown[] }).__warnings__
    : undefined;
  if (Array.isArray(collector)) {
    collector.push(warning);
  } else {
    // biome-ignore lint/suspicious/noConsole: documented fallback when no warning collector is attached to the render.
    console.warn(warning.message);
  }
};

interface UndefinedResolution {
  errorDef: ErrorDefinitionEntry;
  params: Record<string, string>;
  subject: string | null;
  warningName: string;
  warningMessage: () => string;
}

const resolveUndefined = (options: ResolveUndefinedOptions, resolution: UndefinedResolution): 'undefined' => {
  const { self, lineno, colno, mode, phase, templateName } = options;

  if (mode === 'strict') {
    throwRuntimeError(resolution.errorDef, {
      self,
      lineno,
      colno,
      params: resolution.params,
      subject: resolution.subject,
      templateName,
    });
  }

  if (mode === 'debug') {
    emitUndefinedWarning(self, {
      name: resolution.warningName,
      message: resolution.warningMessage,
      subject: resolution.subject,
      lineno,
      colno,
      phase,
      templateName,
      mode,
      varName: resolution.subject,
    });
  }

  return 'undefined';
};

const resolveUndefinedProperty = (options: ResolveUndefinedOptions): 'undefined' => {
  const { val: value, varName } = options;
  const propResult = value as PropertyNotFoundResult;
  const accessPath = propResult.__access_path__ ?? varName ?? 'unknown';
  const parentName = (!propResult.__nunjucks_parent__ && varName?.includes('.'))
    ? varName.slice(0, varName.lastIndexOf('.'))
    : propResult.__nunjucks_parent__;
  return resolveUndefined(options, {
    errorDef: ERROR_DEFINITIONS.UNDEFINED_PROPERTY,
    params: { property: accessPath, parent: parentName ?? 'unknown' },
    subject: accessPath,
    warningName: 'UNDEFINED_PROPERTY',
    warningMessage: () => `Property '${accessPath}' not found in '${parentName ?? 'unknown'}'`,
  });
};

const resolveNullAccess = (options: ResolveUndefinedOptions): 'undefined' => {
  const { val: value, varName } = options;
  const nullResult = value as NullAccessResult;
  const accessPath = nullResult.__access_path__ ?? varName ?? 'unknown';
  const parentName = nullResult.__nunjucks_parent__ ?? varName ?? 'unknown';
  return resolveUndefined(options, {
    errorDef: ERROR_DEFINITIONS.NULL_VALUE,
    params: { accessPath, state: 'null', parent: parentName },
    subject: accessPath,
    warningName: 'NULL_VALUE',
    warningMessage: () => `Cannot access '${accessPath}' on null '${parentName}'`,
  });
};

const resolveUndefinedValue = (options: ResolveUndefinedOptions): 'undefined' => {
  const { varName } = options;
  const errorDef: ErrorDefinitionEntry = varName
    ? ERROR_DEFINITIONS.UNDEFINED_VARIABLE
    : { name: 'UNDEFINED_VALUE', message: () => 'Undefined value', pattern: MATCH_ANY_RE } as const;
  return resolveUndefined(options, {
    errorDef,
    params: { name: varName ?? '' },
    subject: varName,
    warningName: 'UNDEFINED_VARIABLE',
    warningMessage: () => varName
      ? `Variable '${varName}' is undefined or null`
      : 'Variable is undefined or null',
  });
};

export interface EnsureDefinedOptions {
  lineno?: number | null;
  colno?: number | null;
  varName?: string | null;
  undefinedMode?: 'chainable' | 'strict' | 'debug';
}

export function ensureDefined(
  this: unknown,
  value: unknown,
  options: EnsureDefinedOptions = {}
): unknown {
  const { lineno, colno, varName = null, undefinedMode = 'chainable' } = options;
  if (isPropertyNotFoundResult(value) || isNullAccessResult(value)) {
    const ctx = getLogContext(this);
    const effectiveTemplateName = ctx.templateName ?? 'inline';
    const resolveOptions: ResolveUndefinedOptions = {
      self: this,
      val: value,
      varName,
      lineno,
      colno,
      mode: undefinedMode,
      phase: ctx.phase ?? 'render',
      templateName: effectiveTemplateName,
    };
    if (isPropertyNotFoundResult(value)) {
      return resolveUndefinedProperty(resolveOptions);
    }
    return resolveNullAccess(resolveOptions);
  }

  if (!isNonNullish(value)) {
    const ctx = getLogContext(this);
    const effectiveTemplateName = ctx.templateName ?? 'inline';
    return resolveUndefinedValue({
      self: this,
      val: value,
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
