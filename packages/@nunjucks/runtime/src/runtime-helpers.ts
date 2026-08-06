import { createLog, normalizeErrorMetadata, ERROR_DEFINITIONS, type ErrorContext } from '@nunjucks/log';
import { isArray, isIterable, isKeyedObject, isPlainObject, isString, MATCH_ANY_RE } from '@nunjucks/shared';
import {
  getNullParentName,
  isNullAccessResult,
} from './member-access.ts';
import {
  getLogContext,
  throwRuntimeError,
} from './log-context.ts';

const RESERVED_KEYWORD_CONTEXTS: Record<string, string> = {
  super: 'block that extends a parent template',
};

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
  if (RESERVED_KEYWORD_CONTEXTS[name]) {
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
  }

  if (typeof obj === 'function') {
    return obj.apply(context, args);
  }
  throwRuntimeError(ERROR_DEFINITIONS.NOT_A_FUNCTION, {
    self: this,
    lineno,
    colno,
    params: { name: messageName, type: typeof obj },
    subject: name,
  });
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
  const val = typeof ctx.lookup !== 'function' && isKeyedObject(ctx) ? (ctx as Record<string, unknown>)[key] : undefined;
  if (val === undefined) {
    return defaultValue;
  }
  return val;
}

function handleError(this: unknown, error: unknown, lineno: number | null, colno: number | null): never {
  const ctx = getLogContext(this);
  const metadata = normalizeErrorMetadata(error, {
    lineno,
    colno,
    phase: ctx.phase || 'render',
    templateName: ctx.templateName || 'inline',
    renderContext: ctx.renderContext || null,
    lineBase: 'zero',
  });

  if (metadata.lineno !== null && error instanceof Error) {
    const errorLineno = (error as Error & { lineno?: number }).lineno;
    if (errorLineno !== undefined && errorLineno !== null) {
      throw error;
    }
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
  );

  thrown.templatePath = metadata.templatePath;
  thrown.sourceStartLine = metadata.sourceStartLine;
  throw thrown;
}

function fromIterator(arr: unknown): unknown {
  if (typeof arr !== 'object' || arr === null || isArray(arr)) {
    return arr;
  }
  if (isIterable(arr)) {
    return Array.from(arr);
  }
  return arr;
}

function inOperator(this: unknown, key: unknown, val: unknown, lineno: number | null = null, colno: number | null = null): boolean {
  if (isArray(val) || isString(val)) {
    return (val as { includes: (k: unknown) => boolean }).includes(key);
  }
  if (isPlainObject(val)) {
    return isKeyedObject(val) && String(key) in val;
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
