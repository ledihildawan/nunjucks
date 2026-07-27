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
export const MATCH_ANY_RE = /./u;

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
    const strVal = (val as { toString: () => string }).toString();
    const isJsonValue = JSON_SCALAR_RE.test(strVal.trim());
    const isJsonContainer = JSON_CONTAINER_RE.test(strVal);

    if (isJsonValue || isJsonContainer || Array.isArray(val) || typeof val === 'object') {
      const encoded = JSON.stringify(val);
      if (RAW_OR_ESCAPED_LT_RE.test(encoded)) {
        const ctx = getLogContext(this);
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
            lineBase: 'zero'
          }
        );
      }
      return encoded;
    }
  }

  let normalized: string;
  if (isNonNullish(val)) {
    normalized = val as string;
  } else {
    normalized = '';
  }

  if (autoescape && !isSafeString(normalized)) {
    const strVal = (normalized as { toString: () => string }).toString();
    const escaped = escapeValue(strVal, context);

    const normalizedIsArray = Array.isArray(normalized);
    const isJsonValue = JSON_SCALAR_RE.test(strVal.trim());
    const isJsonContainer = JSON_CONTAINER_RE.test(strVal);

    if ((normalizedIsArray || isJsonValue || isJsonContainer) && ESCAPED_HTML_ENTITY_RE.test(escaped)) {
      const ctx = getLogContext(this);
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
          lineBase: 'zero'
        }
      );
    }

    return escaped;
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
  let collector: unknown[] | undefined;
  if (self && typeof self === 'object') {
    collector = (self as { __warnings__?: unknown[] }).__warnings__;
  }
  if (Array.isArray(collector)) {
    collector.push(warning);
  } else {
    // biome-ignore lint/suspicious/noConsole: documented fallback when no warning collector is attached to the render.
    console.warn(warning.message);
  }
};

const resolveUndefinedProperty = (opts: ResolveUndefinedOptions): 'undefined' => {
  const { self, val, varName, lineno, colno, mode, phase, templateName } = opts;
  const propResult = val as { __access_path__?: string; __nunjucks_parent__?: string };
  const accessPath = propResult.__access_path__ || varName || 'unknown';
  let parentName = propResult.__nunjucks_parent__;
  if (!parentName && varName && varName.includes('.')) {
    const lastDot = varName.lastIndexOf('.');
    parentName = varName.slice(0, lastDot);
  }

  if (mode === 'strict') {
    throwRuntimeError(ERROR_DEFINITIONS.UNDEFINED_PROPERTY, {
      self,
      lineno,
      colno,
      params: { property: accessPath, parent: parentName || 'unknown' },
      subject: accessPath,
      templateName,
    });
  }

  if (mode === 'debug') {
    emitUndefinedWarning(self, {
      name: 'UNDEFINED_PROPERTY',
      message: () => `Property '${accessPath}' not found in '${parentName || 'unknown'}'`,
      subject: accessPath,
      lineno,
      colno,
      phase,
      templateName,
      mode,
      varName: accessPath,
    });
  }

  return 'undefined';
};

const resolveNullAccess = (opts: ResolveUndefinedOptions): 'undefined' => {
  const { self, val, varName, lineno, colno, mode, phase, templateName } = opts;
  const nullResult = val as { __access_path__?: string; __nunjucks_parent__?: string };
  const accessPath = nullResult.__access_path__ || varName || 'unknown';
  const parentName = nullResult.__nunjucks_parent__ || varName || 'unknown';

  if (mode === 'strict') {
    throwRuntimeError(ERROR_DEFINITIONS.NULL_VALUE, {
      self,
      lineno,
      colno,
      params: { accessPath, state: 'null', parent: parentName },
      subject: accessPath,
      templateName,
    });
  }

  if (mode === 'debug') {
    emitUndefinedWarning(self, {
      name: 'NULL_VALUE',
      message: () => `Cannot access '${accessPath}' on null '${parentName}'`,
      subject: accessPath,
      lineno,
      colno,
      phase,
      templateName,
      mode,
      varName: accessPath,
    });
  }

  return 'undefined';
};

const resolveUndefinedValue = (opts: ResolveUndefinedOptions): 'undefined' => {
  const { self, varName, lineno, colno, mode, phase, templateName } = opts;

  if (mode === 'strict') {
    let errorDef: ErrorDefinitionEntry;
    if (varName) {
      errorDef = ERROR_DEFINITIONS.UNDEFINED_VARIABLE;
    } else {
      errorDef = { name: 'UNDEFINED_VALUE', message: () => 'Undefined value', pattern: MATCH_ANY_RE } as const;
    }
    throwRuntimeError(errorDef, {
      self,
      lineno,
      colno,
      params: { name: varName ?? '' },
      subject: varName,
      templateName,
    });
  }

  if (mode === 'debug') {
    emitUndefinedWarning(self, {
      name: 'UNDEFINED_VARIABLE',
      message: () => {
        if (varName) {
          return `Variable '${varName}' is undefined or null`;
        }
        return 'Variable is undefined or null';
      },
      subject: varName,
      lineno,
      colno,
      phase,
      templateName,
      mode,
      varName,
    });
  }

  return 'undefined';
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

export { isNonNullish, isFunction, isString, isArray, isPlainObject } from '@nunjucks/shared/type-guards';
export {
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
  isNullAccessResult,
  isPropertyNotFoundResult,
  getNullParentName,
} from '../member-access.ts';
export { createSafeString, isSafeString, copySafeness, markSafe } from '../safe-string.ts';
export {
  makeMacro,
  makeKeywordArgs,
  isKeywordArgs,
  getKeywordArgs,
  numArgs,
  withKwargs,
} from '../macro.ts';
export {
  createSandboxedContext,
  wrapMemberAccess,
  isBlockedKey,
  isDangerousGlobal,
  BLOCKED_KEYS_LIST,
  DANGEROUS_GLOBALS_LIST,
} from '../sandbox.ts';
