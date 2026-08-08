import { createLog, ERROR_DEFINITIONS } from '@nunjucks/log';
import { escapeForContext, isNonNullish, isThenable, type HtmlContext } from '@nunjucks/shared';
import { isSafeString } from './safe-string.ts';
import { getLogContext } from './log-context.ts';

const JSON_SCALAR_RE = /^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/u;
const JSON_CONTAINER_RE = /^[[{]/u;
const RAW_OR_ESCAPED_LT_RE = /<|&lt;/u;
const ESCAPED_HTML_ENTITY_RE = /&[quot;<>]/u;
const SCRIPT_VALUE_NOT_HANDLED = Symbol('scriptValueNotHandled');

const escapeValue = (value: unknown, context: HtmlContext = 'html'): string => {
  if (!isNonNullish(value)) { return ''; }
  return escapeForContext(String(value), context);
};

interface LocationOptions {
  lineno?: number | null;
  colno?: number | null;
}

const throwEscapedJsonError = (self: unknown, loc: LocationOptions): never => {
  const ctx = getLogContext(self);
  throw createLog('error', {
    def: ERROR_DEFINITIONS.JSON_ESCAPED_OUTPUT,
    params: {},
    subject: null,
    context: {
      lineno: loc.lineno ?? null,
      colno: loc.colno ?? null,
      phase: ctx.phase ?? 'render',
      templateName: ctx.templateName ?? 'inline',
      lineBase: 'zero',
    },
  });
};

const isScriptJsonLike = (value: unknown, stringValue: string): boolean =>
  JSON_SCALAR_RE.test(stringValue.trim()) ||
  JSON_CONTAINER_RE.test(stringValue) ||
  Array.isArray(value) ||
  typeof value === 'object';

const isEscapedJsonLike = (value: unknown, stringValue: string): boolean =>
  Array.isArray(value) ||
  JSON_SCALAR_RE.test(stringValue.trim()) ||
  JSON_CONTAINER_RE.test(stringValue);

const suppressScriptValue = (self: unknown, value: unknown, loc: LocationOptions): unknown => {
  const stringValue = String(value);
  if (!isScriptJsonLike(value, stringValue)) {
    return SCRIPT_VALUE_NOT_HANDLED;
  }
  const encoded = JSON.stringify(value);
  if (RAW_OR_ESCAPED_LT_RE.test(encoded)) {
    throwEscapedJsonError(self, loc);
  }
  return encoded;
};

const suppressEscapedValue = (
  self: unknown,
  normalized: unknown,
  options: { context: HtmlContext } & LocationOptions
): string => {
  const stringValue = String(normalized);
  const escaped = escapeValue(stringValue, options.context);
  if (
    isEscapedJsonLike(normalized, stringValue) &&
    ESCAPED_HTML_ENTITY_RE.test(escaped)
  ) {
    throwEscapedJsonError(self, options);
  }
  return escaped;
};

export interface SuppressValueOptions extends LocationOptions {
  autoescape?: boolean;
  context?: HtmlContext;
}

export function suppressValue(
  this: unknown,
  value: unknown,
  options: SuppressValueOptions = {}
): unknown {
  const { autoescape, lineno, colno, context = 'html' } = options;
  const loc = { lineno, colno };
  if (isThenable(value)) {
    return value.then((v) => suppressValue.call(this, v, options));
  }

  if (autoescape && context === 'script' && !isSafeString(value)) {
    const scriptValue = suppressScriptValue(this, value, loc);
    if (scriptValue !== SCRIPT_VALUE_NOT_HANDLED) {
      return scriptValue;
    }
  }

  const normalized: unknown = isNonNullish(value) ? value : '';

  if (autoescape && !isSafeString(normalized)) {
    return suppressEscapedValue(this, normalized, { context, ...loc });
  }

  return normalized;
}
