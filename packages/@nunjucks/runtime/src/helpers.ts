// RUNTIME HELPERS - suppressValue, awaitValue, ensureDefined, callWrap, etc.
// Import directly: import { suppressValue } from '@nunjucks/runtime/helpers'

import { createLog, normalizeErrorMetadata, ERROR_DEFINITIONS } from '@nunjucks/log';
import type { ErrorContext, ErrorDefinitionEntry, WarningContext } from '@nunjucks/log/create-log';
import { escapeForContext, type HtmlContext } from '@nunjucks/shared';
// Imported for use inside this module.
import { isNonNullish, isFunction, isString, isArray, isPlainObject } from '@nunjucks/shared/type-guards';
import { isNullAccessResult, isPropertyNotFoundResult, getNullParentName } from './member-access.ts';
import { isSafeString } from './safe-string.ts';

// This module doubles as the runtime's public surface, so it re-exports the
// sibling modules directly rather than importing and re-listing their bindings.
export { isNonNullish, isFunction, isString, isArray, isPlainObject } from '@nunjucks/shared/type-guards';
export {
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
  isNullAccessResult,
  isPropertyNotFoundResult,
  getNullParentName,
} from './member-access.ts';
export { createSafeString, isSafeString, copySafeness, markSafe } from './safe-string.ts';
export {
  makeMacro,
  makeKeywordArgs,
  isKeywordArgs,
  getKeywordArgs,
  numArgs,
  withKwargs,
} from './macro.ts';
export {
  createSandboxedContext,
  wrapMemberAccess,
  isBlockedKey,
  isDangerousGlobal,
  BLOCKED_KEYS_LIST,
  DANGEROUS_GLOBALS_LIST,
} from './sandbox.ts';
export { createFrame } from './frame.ts';
export { createContext } from './context.ts';
export { toContext, createIsolatedContext, createForkedContext } from './render-context.ts';

// Hoisted so each pattern is compiled once rather than on every value render.
const JSON_SCALAR_RE = /^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/u;
const JSON_CONTAINER_RE = /^[[{]/u;
const RAW_OR_ESCAPED_LT_RE = /<|&lt;/u;
const ESCAPED_HTML_ENTITY_RE = /&[quot;<>]/u;
/** Placeholder pattern for synthesised error definitions, which are never matched against. */
const MATCH_ANY_RE = /./u;

interface LogContextShape {
  templateName: string | null;
  phase: string;
  renderContext: Record<string, unknown> | null;
}

const getLogContext = (self: unknown): LogContextShape => {
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

const throwRuntimeError = (
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

export function suppressValue(
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

    const isArray = Array.isArray(normalized);
    const isJsonValue = JSON_SCALAR_RE.test(strVal.trim());
    const isJsonContainer = JSON_CONTAINER_RE.test(strVal);

    if ((isArray || isJsonValue || isJsonContainer) && ESCAPED_HTML_ENTITY_RE.test(escaped)) {
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

export function awaitValue(val: unknown): unknown {
  if (val && typeof (val as { then?: unknown }).then === 'function') {
    return (val as Promise<unknown>).then((v) => v);
  }
  return val;
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
    parentName = varName.substring(0, lastDot);
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

export function callWrap(
  this: unknown,
  obj: unknown,
  name: string,
  displayName: string | null,
  context: unknown,
  args: unknown[],
  lineno?: number,
  colno?: number,
): unknown {
  const messageName = displayName || name;
  const reservedKeywordContexts: Record<string, string> = {
    caller: 'macro context ({% call %} block)',
    super: 'block that extends a parent template',
  };
  if (reservedKeywordContexts[name]) {
    throwRuntimeError(ERROR_DEFINITIONS.RESERVED_KEYWORD_CONTEXT, {
      self: this,
      lineno,
      colno,
      params: { name },
      subject: name,
    });
  }

  if (isNullAccessResult(obj)) {
    const parentName = getNullParentName(obj) || name;
    throwRuntimeError(ERROR_DEFINITIONS.NULL_VALUE, {
      self: this,
      lineno,
      colno,
      params: { accessPath: name, state: 'null', parent: parentName },
      subject: name,
    });
  }

  if (!obj) {
    throwRuntimeError(ERROR_DEFINITIONS.NULL_VALUE, {
      self: this,
      lineno,
      colno,
      params: { accessPath: name, state: 'null', parent: name },
      subject: name,
    });
  } else if (!isFunction(obj)) {
    throwRuntimeError(ERROR_DEFINITIONS.NOT_A_FUNCTION, {
      self: this,
      lineno,
      colno,
      params: { name: messageName, type: typeof obj },
      subject: name,
    });
  }

  return (obj as (...a: unknown[]) => unknown).apply(context, args);
}

export function contextOrFrameLookup(
  context: { lookup: (name: string) => unknown },
  frame: { lookup: (name: string) => unknown },
  name: string,
): unknown {
  const val = frame.lookup(name);
  if (val === undefined) {
    return context.lookup(name);
  }
  return val;
}

export function lookup(ctx: { lookup?: (key: string) => unknown } | null, key: string, defaultValue?: unknown): unknown {
  if (!ctx) { return defaultValue; }
  if (typeof ctx.lookup === 'function') {
    const val = ctx.lookup(key);
    if (val === undefined) {
      return defaultValue;
    }
    return val;
  }
  const val = (ctx as Record<string, unknown>)[key];
  if (val === undefined) {
    return defaultValue;
  }
  return val;
}

// `_runtime` is passed positionally by generated template code but unused here.
export function handleError(this: unknown, error: unknown, lineno: number | null, colno: number | null, _runtime?: unknown): never {
  const ctx = getLogContext(this);
  const metadata = normalizeErrorMetadata(error, {
    lineno,
    colno,
    phase: ctx.phase || 'render',
    templateName: ctx.templateName || 'inline',
    renderContext: ctx.renderContext || null,
    lineBase: 'zero',
  });

  if (metadata.lineno !== null && error instanceof Error && (error as Error & { lineno?: number }).lineno !== undefined && (error as Error & { lineno?: number }).lineno !== null) {
    throw error;
  }

  const thrown = createLog(
    'error',
    {
      name: metadata.code || 'RUNTIME_ERROR',
      message: () => metadata.message,
      pattern: MATCH_ANY_RE,
    },
    {},
    metadata.subject,
    {
      lineno: metadata.lineno,
      colno: metadata.colno,
      phase: metadata.phase,
      templateName: metadata.templateName,
      templatePath: metadata.templatePath,
      sourceContent: metadata.sourceContent,
      sourceStartLine: metadata.sourceStartLine,
      renderContext: metadata.renderContext,
      code: metadata.code,
      subject: metadata.subject,
      lineBase: metadata.lineBase,
    } as ErrorContext,
  ) as Error & { templatePath?: unknown; sourceStartLine?: unknown };

  thrown.templatePath = metadata.templatePath;
  thrown.sourceStartLine = metadata.sourceStartLine;
  throw thrown;
}

export function fromIterator(arr: unknown): unknown {
  if (typeof arr !== 'object' || arr === null || isArray(arr)) {
    return arr;
  }if (Symbol.iterator in (arr as object)) {
    return Array.from(arr as Iterable<unknown>);
  }
    return arr;
}

export function inOperator(this: unknown, key: unknown, val: unknown, lineno: number | null = null, colno: number | null = null): boolean {
  if (isArray(val) || isString(val)) {
    return (val as { includes: (k: unknown) => boolean }).includes(key);
  }
  if (isPlainObject(val)) {
    return (key as string | number | symbol) in (val as object);
  }
  return throwRuntimeError(ERROR_DEFINITIONS.IN_OPERATOR, {
    self: this,
    lineno,
    colno,
    params: { key: String(key), type: typeof val },
    subject: String(key),
  });
}
