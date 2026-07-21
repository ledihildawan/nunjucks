// RUNTIME HELPERS - suppressValue, awaitValue, ensureDefined, callWrap, etc.
// Import directly: import { suppressValue } from '@nunjucks/runtime/helpers'

import { createLog, normalizeErrorMetadata, ERROR_DEFINITIONS } from '@nunjucks/log';
import {
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
  isNullAccessResult,
  isPropertyNotFoundResult,
  getNullParentName,
} from './member-access.ts';
import { createSafeString, isSafeString, copySafeness, markSafe } from './safe-string.ts';
import {
  makeMacro,
  makeKeywordArgs,
  isKeywordArgs,
  getKeywordArgs,
  numArgs,
  withKwargs,
} from './macro.ts';
import {
  createSandboxedContext,
  wrapMemberAccess,
  isBlockedKey,
  isDangerousGlobal,
  BLOCKED_KEYS_LIST,
  DANGEROUS_GLOBALS_LIST,
} from './sandbox.ts';
import { createFrame } from './frame.ts';
import { createContext } from './context.ts';
import { toContext, createIsolatedContext, createForkedContext } from './render-context.ts';

const isArray = (v: unknown): boolean => Array.isArray(v);
const isNonNullish = (v: unknown): boolean => v !== null && v !== undefined;
const isFunction = (v: unknown): boolean => typeof v === 'function';
const isString = (v: unknown): boolean => typeof v === 'string';
const isPlainObject = (v: unknown): boolean => {
  if (typeof v !== 'object' || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

export {
  createFrame,
  createSafeString,
  isSafeString,
  copySafeness,
  markSafe,
  makeMacro,
  makeKeywordArgs,
  isKeywordArgs,
  getKeywordArgs,
  numArgs,
  withKwargs,
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
  isNullAccessResult,
  isPropertyNotFoundResult,
  getNullParentName,
  isArray,
  isNonNullish,
  isFunction,
  isString,
  isPlainObject,
  createSandboxedContext,
  wrapMemberAccess,
  isBlockedKey,
  isDangerousGlobal,
  BLOCKED_KEYS_LIST,
  DANGEROUS_GLOBALS_LIST,
  toContext,
  createIsolatedContext,
  createForkedContext,
  createContext,
};

const escapeHtml = (val: unknown): string => {
  if (!isNonNullish(val)) return '';
  const str = String(val);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\\/g, '&#92;');
};

export function suppressValue(val: unknown, autoescape?: boolean): unknown {
  if (val && typeof (val as { then?: unknown }).then === 'function') {
    return (val as Promise<unknown>).then((v) => suppressValue(v, autoescape));
  }

  const normalized = isNonNullish(val) ? val : '';

  if (autoescape && !isSafeString(normalized)) {
    return escapeHtml((normalized as { toString(): string }).toString());
  }

  return normalized;
}

export function awaitValue(val: unknown): unknown {
  if (val && typeof (val as { then?: unknown }).then === 'function') {
    return (val as Promise<unknown>).then((v) => v);
  }
  return val;
}

export function ensureDefined(
  this: unknown,
  val: unknown,
  lineno: number,
  colno: number,
  varName: string | null = null,
  templateName: string | null = null,
  undefinedMode: 'chainable' | 'strict' | 'debug' = 'chainable',
): unknown {
  if (isPropertyNotFoundResult(val) || isNullAccessResult(val)) {
    const ctx = (this && (this as { logContext?: unknown }).logContext)
      ? ((this as { logContext: { templateName: string | null; phase: string } }).logContext)
      : { templateName: null, phase: 'render' };
    const effectiveTemplateName = templateName || ctx.templateName || 'inline';

    if (isPropertyNotFoundResult(val)) {
      const propResult = val as { __access_path__?: string; __nunjucks_parent__?: string };
      const accessPath = propResult.__access_path__ || varName || 'unknown';
      let parentName = propResult.__nunjucks_parent__;
      if (!parentName && varName && varName.includes('.')) {
        const lastDot = varName.lastIndexOf('.');
        parentName = varName.substring(0, lastDot);
      }

      if (undefinedMode === 'strict') {
        throw createLog(
          'error',
          ERROR_DEFINITIONS.UNDEFINED_PROPERTY,
          { property: accessPath, parent: parentName || 'unknown' },
          accessPath,
          { lineno, colno, phase: ctx.phase || 'render', templateName: effectiveTemplateName, lineBase: 'zero' },
        );
      }

      if (undefinedMode === 'debug') {
        const warning = createLog(
          'warning',
          {
            name: 'UNDEFINED_PROPERTY',
            message: () => `Property '${accessPath}' not found in '${parentName || 'unknown'}'`,
            pattern: /./,
          },
          {},
          accessPath,
          {
            lineno,
            colno,
            phase: ctx.phase || 'render',
            templateName: effectiveTemplateName,
            undefinedMode,
            varName: accessPath,
            lineBase: 'zero',
          },
        );
        if (this && (this as { __warnings__?: unknown[] }).__warnings__) {
          (this as { __warnings__: unknown[] }).__warnings__.push(warning);
        } else {
          console.warn((warning as { output: (opts: unknown) => string }).output({ verbosity: 'medium', dev: true }));
        }
      }

      return 'undefined';
    }

    const nullResult = val as { __access_path__?: string; __nunjucks_parent__?: string };
    const accessPath = nullResult.__access_path__ || varName || 'unknown';
    const parentName = nullResult.__nunjucks_parent__ || varName || 'unknown';

    if (undefinedMode === 'strict') {
      throw createLog(
        'error',
        ERROR_DEFINITIONS.NULL_VALUE,
        { accessPath, state: 'null', parent: parentName },
        accessPath,
        { lineno, colno, phase: ctx.phase || 'render', templateName: effectiveTemplateName, lineBase: 'zero' },
      );
    }

    if (undefinedMode === 'debug') {
      const warning = createLog(
        'warning',
        {
          name: 'NULL_VALUE',
          message: () => `Cannot access '${accessPath}' on null '${parentName}'`,
          pattern: /./,
        },
        {},
        accessPath,
        {
          lineno,
          colno,
          phase: ctx.phase || 'render',
          templateName: effectiveTemplateName,
          undefinedMode,
          varName: accessPath,
          lineBase: 'zero',
        },
      );
      if (this && (this as { __warnings__?: unknown[] }).__warnings__) {
        (this as { __warnings__: unknown[] }).__warnings__.push(warning);
      } else {
        console.warn((warning as { output: (opts: unknown) => string }).output({ verbosity: 'medium', dev: true }));
      }
    }

    return 'undefined';
  }

  if (!isNonNullish(val)) {
    const ctx = (this && (this as { logContext?: unknown }).logContext)
      ? ((this as { logContext: { templateName: string | null; phase: string } }).logContext)
      : { templateName: null, phase: 'render' };
    const effectiveTemplateName = templateName || ctx.templateName || 'inline';

    if (undefinedMode === 'strict') {
      const errorDef = varName
        ? ERROR_DEFINITIONS.UNDEFINED_VARIABLE
        : ({ name: 'UNDEFINED_VALUE', message: () => 'Undefined value', pattern: /./ } as const);
      throw createLog('error', errorDef, { name: varName }, varName, {
        lineno,
        colno,
        phase: ctx.phase || 'render',
        templateName: effectiveTemplateName,
        lineBase: 'zero',
      });
    }

    if (undefinedMode === 'debug') {
      const warning = createLog(
        'warning',
        {
          name: 'UNDEFINED_VARIABLE',
          message: () => (varName ? `Variable '${varName}' is undefined or null` : 'Variable is undefined or null'),
          pattern: /./,
        },
        {},
        varName,
        {
          lineno,
          colno,
          phase: ctx.phase || 'render',
          templateName: effectiveTemplateName,
          undefinedMode,
          varName,
          lineBase: 'zero',
        },
      );
      if (this && (this as { __warnings__?: unknown[] }).__warnings__) {
        (this as { __warnings__: unknown[] }).__warnings__.push(warning);
      } else {
        console.warn((warning as { output: (opts: unknown) => string }).output({ verbosity: 'medium', dev: true }));
      }
    }

    return 'undefined';
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
  const ctx = (this && (this as { logContext?: unknown }).logContext)
    ? ((this as { logContext: { templateName: string | null; phase: string } }).logContext)
    : { templateName: null, phase: 'render' };
  const messageName = displayName || name;
  const reservedKeywordContexts: Record<string, string> = {
    caller: 'macro context ({% call %} block)',
    super: 'block that extends a parent template',
  };
  if (reservedKeywordContexts[name]) {
    throw createLog('error', ERROR_DEFINITIONS.RESERVED_KEYWORD_CONTEXT, { name }, name, {
      lineno,
      colno,
      phase: ctx.phase || 'render',
      templateName: ctx.templateName || 'inline',
      lineBase: 'zero',
    });
  }

  if (isNullAccessResult(obj)) {
    const parentName = getNullParentName(obj) || name;
    throw createLog('error', ERROR_DEFINITIONS.NULL_VALUE, { accessPath: name, state: 'null', parent: parentName }, name, {
      lineno,
      colno,
      phase: ctx.phase || 'render',
      templateName: ctx.templateName || 'inline',
      lineBase: 'zero',
    });
  }

  if (!obj) {
    throw createLog('error', ERROR_DEFINITIONS.NULL_VALUE, { accessPath: name, state: 'null', parent: name }, name, {
      lineno,
      colno,
      phase: ctx.phase || 'render',
      templateName: ctx.templateName || 'inline',
      lineBase: 'zero',
    });
  } else if (!isFunction(obj)) {
    throw createLog('error', ERROR_DEFINITIONS.NOT_A_FUNCTION, { name: messageName, type: typeof obj }, name, {
      lineno,
      colno,
      phase: ctx.phase || 'render',
      templateName: ctx.templateName || 'inline',
      lineBase: 'zero',
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
  return val !== undefined ? val : context.lookup(name);
}

export function lookup(ctx: { lookup?: (key: string) => unknown } | null, key: string, defaultValue: unknown = undefined): unknown {
  if (!ctx) return defaultValue;
  if (typeof ctx.lookup === 'function') {
    const val = ctx.lookup(key);
    return val !== undefined ? val : defaultValue;
  }
  const val = (ctx as Record<string, unknown>)[key];
  return val !== undefined ? val : defaultValue;
}

export function handleError(this: unknown, error: unknown, lineno: number | null, colno: number | null, runtime?: unknown): never {
  const ctx = (this && (this as { logContext?: unknown }).logContext)
    ? ((this as { logContext: { templateName: string | null; phase: string; renderContext: unknown } }).logContext)
    : { templateName: null, phase: 'render', renderContext: null };
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
      pattern: /./,
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
    },
  ) as Error & { templatePath?: unknown; sourceStartLine?: unknown };

  thrown.templatePath = metadata.templatePath;
  thrown.sourceStartLine = metadata.sourceStartLine;
  throw thrown;
}

export function fromIterator(arr: unknown): unknown {
  if (typeof arr !== 'object' || arr === null || isArray(arr)) {
    return arr;
  } else if (Symbol.iterator in (arr as object)) {
    return Array.from(arr as Iterable<unknown>);
  } else {
    return arr;
  }
}

export function inOperator(this: unknown, key: unknown, val: unknown, lineno: number | null = null, colno: number | null = null): boolean {
  if (isArray(val) || isString(val)) {
    return (val as { includes: (k: unknown) => boolean }).includes(key);
  }
  if (isPlainObject(val)) {
    return key in (val as object);
  }
  const ctx = (this && (this as { logContext?: unknown }).logContext)
    ? ((this as { logContext: { templateName: string | null; phase: string; renderContext: unknown } }).logContext)
    : { templateName: 'inline', phase: 'render', renderContext: null };
  throw createLog(
    'error',
    ERROR_DEFINITIONS.IN_OPERATOR,
    { key: String(key), type: typeof val },
    String(key),
    {
      lineno,
      colno,
      phase: ctx.phase || 'render',
      templateName: ctx.templateName || 'inline',
      lineBase: 'zero',
    },
  );
}
