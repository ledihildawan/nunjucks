// RUNTIME HELPERS - suppressValue, awaitValue, ensureDefined, callWrap, etc.
// Import directly: import { suppressValue } from '@nunjucks/runtime/helpers'

import { createLog, ERROR_DEFINITIONS } from '@nunjucks/log';
import type { ErrorContext, ErrorDefinitionEntry, WarningContext } from '@nunjucks/log/create-log';
import { escapeForContext, type HtmlContext } from '@nunjucks/shared';
// Imported for use inside this module.
import { isNonNullish } from '@nunjucks/shared/type-guards';
import { isNullAccessResult, isPropertyNotFoundResult } from '../member-access.ts';
import { isSafeString } from '../safe-string.ts';

// This module doubles as the runtime's public surface, so it re-exports the
// sibling modules directly rather than importing and re-listing their bindings.
// Hoisted so each pattern is compiled once rather than on every value render.
const JSON_SCALAR_RE = /^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/u;
const JSON_CONTAINER_RE = /^[[{]/u;
const RAW_OR_ESCAPED_LT_RE = /<|&lt;/u;
const ESCAPED_HTML_ENTITY_RE = /&[quot;<>]/u;
/** Placeholder pattern for synthesised error definitions, which are never matched against. */
import { MATCH_ANY_RE } from '@nunjucks/shared';
export { MATCH_ANY_RE };
const SCRIPT_VALUE_NOT_HANDLED = Symbol('scriptValueNotHandled');

interface LogContextShape {
  templateName: string | null;
  phase: string;
  renderContext: Record<string, unknown> | null;
}

export const getLogContext = (self: unknown): LogContextShape => {
  if (self && (self as { logContext?: LogContextShape }).logContext) {
    return (self as { logContext: LogContextShape }).logContext;
  }
  return { templateName: null, phase: 'render', renderContext: null };
};

interface ThrowRuntimeErrorOptions {
  self: unknown;
  lineno?: number | null;
  colno?: number | null;
  params?: Record<string, string>;
  subject?: string | null;
  templateName?: string | null;
}

export const throwRuntimeError = (
  def: ErrorDefinitionEntry,
  { self, lineno, colno, params, subject, templateName }: ThrowRuntimeErrorOptions,
): never => {
  const ctx = getLogContext(self);
  throw createLog(
    'error',
    def,
    params ?? {},
    subject ?? null,
    {
      lineno: lineno ?? null,
      colno: colno ?? null,
      phase: ctx.phase || 'render',
      templateName: templateName ?? (ctx.templateName || 'inline'),
      lineBase: 'zero',
    } as ErrorContext,
  );
};


const escapeValue = (val: unknown, context: HtmlContext = 'html'): string => {
  if (!isNonNullish(val)) { return ''; }
  return escapeForContext(String(val), context);
};

const throwEscapedJsonError = (
  self: unknown,
  lineno?: number | null,
  colno?: number | null
): never => {
  const ctx = getLogContext(self);
  throw createLog(
    'error',
    ERROR_DEFINITIONS.JSON_ESCAPED_OUTPUT,
    {},
    null,
    {
      lineno: lineno ?? null,
      colno: colno ?? null,
      phase: ctx.phase || 'render',
      templateName: ctx.templateName || 'inline',
      lineBase: 'zero',
    }
  );
};

const isScriptJsonLike = (val: unknown, stringValue: string): boolean =>
  JSON_SCALAR_RE.test(stringValue.trim()) ||
  JSON_CONTAINER_RE.test(stringValue) ||
  Array.isArray(val) ||
  typeof val === 'object';

const isEscapedJsonLike = (val: unknown, stringValue: string): boolean =>
  Array.isArray(val) ||
  JSON_SCALAR_RE.test(stringValue.trim()) ||
  JSON_CONTAINER_RE.test(stringValue);

const suppressScriptValue = (
  self: unknown,
  val: unknown,
  lineno?: number | null,
  colno?: number | null
): unknown => {
  const stringValue = (val as { toString: () => string }).toString();
  if (!isScriptJsonLike(val, stringValue)) {
    return SCRIPT_VALUE_NOT_HANDLED;
  }
  const encoded = JSON.stringify(val);
  if (RAW_OR_ESCAPED_LT_RE.test(encoded)) {
    throwEscapedJsonError(self, lineno, colno);
  }
  return encoded;
};

const suppressEscapedValue = (
  self: unknown,
  normalized: string,
  context: HtmlContext,
  lineno?: number | null,
  colno?: number | null
): string => {
  const stringValue = (
    normalized as { toString: () => string }
  ).toString();
  const escaped = escapeValue(stringValue, context);
  if (
    isEscapedJsonLike(normalized, stringValue) &&
    ESCAPED_HTML_ENTITY_RE.test(escaped)
  ) {
    throwEscapedJsonError(self, lineno, colno);
  }
  return escaped;
};

function suppressValue(
  this: unknown,
  val: unknown,
  autoescape?: boolean,
  lineno?: number | null,
  colno?: number | null,
  context: HtmlContext = 'html'
): unknown {
  if (val && typeof (val as { then?: unknown }).then === 'function') {
    return (val as Promise<unknown>).then((v) => suppressValue.call(this, v, autoescape, lineno, colno, context));
  }

  if (autoescape && context === 'script' && !isSafeString(val)) {
    const scriptValue = suppressScriptValue(this, val, lineno, colno);
    if (scriptValue !== SCRIPT_VALUE_NOT_HANDLED) {
      return scriptValue;
    }
  }

  const normalized = isNonNullish(val) ? val as string : '';

  if (autoescape && !isSafeString(normalized)) {
    return suppressEscapedValue(
      this,
      normalized,
      context,
      lineno,
      colno
    );
  }

  return normalized;
}

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
  const parentName = (!propResult.__nunjucks_parent__ && varName && varName.includes('.'))
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

function ensureDefined(
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

export { suppressValue, ensureDefined };
