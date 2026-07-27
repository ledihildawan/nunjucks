import { createLog, normalizeErrorMetadata, ERROR_DEFINITIONS } from '@nunjucks/log';
import type { ErrorContext } from '@nunjucks/log/create-log';
import { isArray, isFunction, isPlainObject, isString } from '@nunjucks/shared/type-guards';
import {
  getNullParentName,
  isNullAccessResult,
} from '../member-access.ts';
import {
  getLogContext,
  MATCH_ANY_RE,
  throwRuntimeError,
} from './suppress-value.ts';
function callWrap(
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

function contextOrFrameLookup(
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

function lookup(ctx: { lookup?: (key: string) => unknown } | null, key: string, defaultValue?: unknown): unknown {
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
function handleError(this: unknown, error: unknown, lineno: number | null, colno: number | null, _runtime?: unknown): never {
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

function fromIterator(arr: unknown): unknown {
  if (typeof arr !== 'object' || arr === null || isArray(arr)) {
    return arr;
  }if (Symbol.iterator in (arr as object)) {
    return Array.from(arr as Iterable<unknown>);
  }
    return arr;
}

function inOperator(this: unknown, key: unknown, val: unknown, lineno: number | null = null, colno: number | null = null): boolean {
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
export {
  callWrap,
  contextOrFrameLookup,
  lookup,
  handleError,
  fromIterator,
  inOperator,
};

export {
  getNullParentName,
  isNullAccessResult,
  isPropertyNotFoundResult,
  memberLookup,
  nullishCoalesce,
  optionalMemberLookup,
  slice,
} from '../member-access.ts';