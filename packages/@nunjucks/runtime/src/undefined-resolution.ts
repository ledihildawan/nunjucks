import { createLog, ERROR_DEFINITIONS, type ErrorDefinitionEntry, type WarningContext } from '@nunjucks/log';
import { isNonNullish, MATCH_ANY_RE } from '@nunjucks/shared';
import { isNullAccessResult, isPropertyNotFoundResult } from './member-access.ts';
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

const emitUndefinedWarning = (self: unknown, opts: EmitUndefinedWarningOptions): void => {
  const warning = createLog(
    'warning',
    {
      name: opts.name,
      message: opts.message,
      pattern: MATCH_ANY_RE,
    },
    {},
    opts.subject,
    {
      lineno: opts.lineno ?? null,
      colno: opts.colno ?? null,
      phase: opts.phase,
      templateName: opts.templateName,
      undefinedMode: opts.mode,
      varName: opts.varName,
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

const resolveUndefined = (opts: ResolveUndefinedOptions, r: UndefinedResolution): 'undefined' => {
  const { self, lineno, colno, mode, phase, templateName } = opts;

  if (mode === 'strict') {
    throwRuntimeError(r.errorDef, {
      self,
      lineno,
      colno,
      params: r.params,
      subject: r.subject,
      templateName,
    });
  }

  if (mode === 'debug') {
    emitUndefinedWarning(self, {
      name: r.warningName,
      message: r.warningMessage,
      subject: r.subject,
      lineno,
      colno,
      phase,
      templateName,
      mode,
      varName: r.subject,
    });
  }

  return 'undefined';
};

const resolveUndefinedProperty = (opts: ResolveUndefinedOptions): 'undefined' => {
  const { val, varName } = opts;
  const propResult = val as { __access_path__?: string; __nunjucks_parent__?: string };
  const accessPath = propResult.__access_path__ || varName || 'unknown';
  const parentName = (!propResult.__nunjucks_parent__ && varName?.includes('.'))
    ? varName.slice(0, varName.lastIndexOf('.'))
    : propResult.__nunjucks_parent__;
  return resolveUndefined(opts, {
    errorDef: ERROR_DEFINITIONS.UNDEFINED_PROPERTY,
    params: { property: accessPath, parent: parentName || 'unknown' },
    subject: accessPath,
    warningName: 'UNDEFINED_PROPERTY',
    warningMessage: () => `Property '${accessPath}' not found in '${parentName || 'unknown'}'`,
  });
};

const resolveNullAccess = (opts: ResolveUndefinedOptions): 'undefined' => {
  const { val, varName } = opts;
  const nullResult = val as { __access_path__?: string; __nunjucks_parent__?: string };
  const accessPath = nullResult.__access_path__ || varName || 'unknown';
  const parentName = nullResult.__nunjucks_parent__ || varName || 'unknown';
  return resolveUndefined(opts, {
    errorDef: ERROR_DEFINITIONS.NULL_VALUE,
    params: { accessPath, state: 'null', parent: parentName },
    subject: accessPath,
    warningName: 'NULL_VALUE',
    warningMessage: () => `Cannot access '${accessPath}' on null '${parentName}'`,
  });
};

const resolveUndefinedValue = (opts: ResolveUndefinedOptions): 'undefined' => {
  const { varName } = opts;
  const errorDef: ErrorDefinitionEntry = varName
    ? ERROR_DEFINITIONS.UNDEFINED_VARIABLE
    : { name: 'UNDEFINED_VALUE', message: () => 'Undefined value', pattern: MATCH_ANY_RE } as const;
  return resolveUndefined(opts, {
    errorDef,
    params: { name: varName ?? '' },
    subject: varName,
    warningName: 'UNDEFINED_VARIABLE',
    warningMessage: () => varName
      ? `Variable '${varName}' is undefined or null`
      : 'Variable is undefined or null',
  });
};

export function ensureDefined(
  this: unknown,
  val: unknown,
  lineno?: number | null,
  colno?: number | null,
  varName: string | null = null,
  templateName: string | null = null,
  undefinedMode: 'chainable' | 'strict' | 'debug' = 'chainable',
): unknown {
  if (isPropertyNotFoundResult(val) || isNullAccessResult(val)) {
    const ctx = getLogContext(this);
    const effectiveTemplateName = templateName || ctx.templateName || 'inline';
    const opts: ResolveUndefinedOptions = {
      self: this,
      val,
      varName,
      lineno,
      colno,
      mode: undefinedMode,
      phase: ctx.phase || 'render',
      templateName: effectiveTemplateName,
    };
    if (isPropertyNotFoundResult(val)) {
      return resolveUndefinedProperty(opts);
    }
    return resolveNullAccess(opts);
  }

  if (!isNonNullish(val)) {
    const ctx = getLogContext(this);
    const effectiveTemplateName = templateName || ctx.templateName || 'inline';
    return resolveUndefinedValue({
      self: this,
      val,
      varName,
      lineno,
      colno,
      mode: undefinedMode,
      phase: ctx.phase || 'render',
      templateName: effectiveTemplateName,
    });
  }

  return val;
}
