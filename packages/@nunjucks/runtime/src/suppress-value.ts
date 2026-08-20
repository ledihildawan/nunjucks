import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { createLog } from '@nunjucks/error-formatter';
import { isNonNullish, isThenable } from '@nunjucks/lib';
import { getLogContext } from './error-context.ts';
import { escapeForContext, type HtmlContext } from './escaping/index.ts';
import { isSafeString } from './runtime-contract/safe-string.ts';

const JSON_SCALAR_RE =
  /^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/u;
const JSON_CONTAINER_RE = /^[[{]/u;
const RAW_OR_ESCAPED_LT_RE = /<|&lt;/u;
// WHY: detects already-entity-encoded JSON payloads (escapeHtml output) so script-context
// values are not double-escaped. Alternation over the entity names — a character class
// here would only ever match the `&q` prefix of `&quot;` and never see `&lt;`/`&gt;`.
const ESCAPED_HTML_ENTITY_RE = /&(?:quot|lt|gt|amp)/u;
const SCRIPT_VALUE_NOT_HANDLED = Symbol('scriptValueNotHandled');

const escapeValue = (value: unknown, context: HtmlContext = 'html'): string => {
  if (!isNonNullish(value)) {
    return '';
  }
  return escapeForContext(String(value), context);
};

interface LocationOptions {
  lineno?: number | null;
  colno?: number | null;
}

const throwEscapedJsonError = (runtimeContext: unknown, loc: LocationOptions): never => {
  const ctx = getLogContext(runtimeContext);
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

const suppressScriptValue = (
  runtimeContext: unknown,
  value: unknown,
  loc: LocationOptions
): unknown => {
  const stringValue = String(value);
  if (!isScriptJsonLike(value, stringValue)) {
    return SCRIPT_VALUE_NOT_HANDLED;
  }
  const encoded = JSON.stringify(value);
  if (RAW_OR_ESCAPED_LT_RE.test(encoded)) {
    throwEscapedJsonError(runtimeContext, loc);
  }
  return encoded;
};

const suppressEscapedValue = (
  runtimeContext: unknown,
  normalized: unknown,
  options: { context: HtmlContext } & LocationOptions
): string => {
  const stringValue = String(normalized);
  const escaped = escapeValue(stringValue, options.context);
  if (isEscapedJsonLike(normalized, stringValue) && ESCAPED_HTML_ENTITY_RE.test(escaped)) {
    throwEscapedJsonError(runtimeContext, options);
  }
  return escaped;
};

/** Options governing suppression: autoescape flag, target `HtmlContext`, and source position. */
export interface SuppressValueOptions extends LocationOptions {
  autoescape?: boolean;
  context?: HtmlContext;
}

/**
 * Normalizes a value for output: awaits thenables transparently, maps nullish
 * inputs to `''`, applies context-appropriate escaping under autoescape
 * (including the script-context JSON and attribute-escaping rules for
 * `SafeString`s), and passes `SafeString`s through for body output.
 *
 * @param this - Runtime context carrying template name and phase.
 * @param value - The value to suppress/escape.
 * @param options - Autoescape flag, target HTML context, and source position.
 * @returns The suppressed/escaped value, `''` for nullish, or a Promise for async values.
 */
export function suppressValue(
  this: unknown,
  value: unknown,
  options: SuppressValueOptions = {}
): unknown {
  const { autoescape, lineno, colno, context = 'html' } = options;
  const loc = { lineno, colno };
  if (isThenable(value)) {
    // WHY: async IIFE avoids .then() chain while preserving the hot-path contract —
    // suppressValue is called in generated code and await would force the entire render
    // onto the async promise graph. The async IIFE races the thenable resolution on the
    // microtask queue without altering the caller's async context.
    return (async () => {
      const resolvedValue = await value;
      return suppressValue.call(this, resolvedValue, options);
    })();
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

  // WHY: SafeString marks content "safe for HTML BODY output", not "safe for this
  // attribute" — tojson's structural quotes (or |safe markup) inside a delimited or
  // undelimited attribute value terminate the attribute and open an injection window.
  // Attribute-escaping a SafeString keeps the output entity-decodable, so
  // JSON.parse(el.dataset.x) still round-trips. Script context keeps the passthrough
  // (tojson already escapes < as \u003c for script bodies).
  const isAttributeContext = context === 'attribute' || context === 'unquoted-attribute';
  if (autoescape && isSafeString(normalized) && isAttributeContext) {
    return escapeForContext(String(normalized), context);
  }

  return normalized;
}
