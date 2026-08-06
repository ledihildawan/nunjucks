import { createLog, ERROR_DEFINITIONS, type ErrorContext } from '@nunjucks/log';
import { escapeForContext, isNonNullish, isThenable, type HtmlContext } from '@nunjucks/shared';
import { isSafeString } from './safe-string.ts';
import { getLogContext } from './log-context.ts';

const JSON_SCALAR_RE = /^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/u;
const JSON_CONTAINER_RE = /^[[{]/u;
const RAW_OR_ESCAPED_LT_RE = /<|&lt;/u;
const ESCAPED_HTML_ENTITY_RE = /&[quot;<>]/u;
const SCRIPT_VALUE_NOT_HANDLED = Symbol('scriptValueNotHandled');

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
    } as ErrorContext,
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
  normalized: unknown,
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

export function suppressValue(
  this: unknown,
  val: unknown,
  autoescape?: boolean,
  lineno?: number | null,
  colno?: number | null,
  context: HtmlContext = 'html'
): unknown {
  if (isThenable(val)) {
    return val.then((v) => suppressValue.call(this, v, autoescape, lineno, colno, context));
  }

  if (autoescape && context === 'script' && !isSafeString(val)) {
    const scriptValue = suppressScriptValue(this, val, lineno, colno);
    if (scriptValue !== SCRIPT_VALUE_NOT_HANDLED) {
      return scriptValue;
    }
  }

  const normalized: unknown = isNonNullish(val) ? val : '';

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
