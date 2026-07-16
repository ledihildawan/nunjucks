import { createLog } from '@nunjucks/log';
import { isArray, keys, isNonNullish, isFunction, isString, isPlainObject } from 'remeda';
import { createFrame } from './frame.js';
import {
  createSafeString,
  isSafeString,
  copySafeness,
  markSafe,
} from './safe-string.js';
import {
  makeMacro,
  makeKeywordArgs,
  isKeywordArgs,
  getKeywordArgs,
  numArgs,
  withKwargs,
} from './macro.js';
import {
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
} from './member-access.js';
import {
  createSandboxedContext,
  wrapMemberAccess,
  isBlockedKey,
  isDangerousGlobal,
  BLOCKED_KEYS_LIST,
  DANGEROUS_GLOBALS_LIST,
} from './sandbox.js';
import {
  UNDEFINED_MODES,
  DEFAULT_UNDEFINED_MODE,
  isValidUndefinedMode,
  getUndefinedMode,
} from './undefined.js';

import { toContext, createIsolatedContext, createForkedContext } from './render-context.js';
import { createContext } from './context.js';

const escapeHtml = (val) => {
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
  isArray,
  keys,
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
  UNDEFINED_MODES,
  DEFAULT_UNDEFINED_MODE,
  isValidUndefinedMode,
  getUndefinedMode,
  toContext,
  createIsolatedContext,
  createForkedContext,
  createContext,
};

export function suppressValue(val, autoescape) {
  if (val && typeof val.then === 'function') {
    return val.then(v => suppressValue(v, autoescape));
  }

  val = isNonNullish(val) ? val : '';

  if (autoescape && !isSafeString(val)) {
    val = escapeHtml(val.toString());
  }

  return val;
}

export function awaitValue(val) {
  if (val && typeof val.then === 'function') {
    return val.then(v => v);
  }
  return val;
}

export function ensureDefined(val, lineno, colno, varName = null, templateName = null, undefinedMode = 'chainable') {
  if (!isNonNullish(val)) {
    const ctx = (this && this.logContext) ? this.logContext : { templateName: null, phase: 'render' };
    const effectiveTemplateName = templateName || ctx.templateName || 'inline';

    if (undefinedMode === 'strict') {
      const humanMessage = varName
        ? `Variable '${varName}' is not defined`
        : 'Attempted to output null or undefined value';
      throw createLog('error', {
        message: humanMessage,
        lineno,
        colno,
        info: { code: varName ? 'UNDEFINED_VARIABLE' : 'UNDEFINED_VALUE', subject: varName, phase: ctx.phase || 'render', templateName: effectiveTemplateName }
      });
    }

    if (undefinedMode === 'debug') {
      const warning = createLog('warning', {
        message: varName
          ? `Variable '${varName}' is undefined or null`
          : 'Variable is undefined or null',
        lineno,
        colno,
        info: { varName, templateName: effectiveTemplateName, undefinedMode, phase: ctx.phase || 'render', code: varName ? 'UNDEFINED_VARIABLE' : 'UNDEFINED_VALUE' }
      });
      console.warn(warning.output({ verbosity: 'medium', dev: true }));
      if (this && this.__warnings__) {
        this.__warnings__.push(warning);
      }
    }

    return 'undefined';
  }
  return val;
}

export function callWrap(obj, name, displayName, context, args, lineno, colno) {
  const ctx = (this && this.logContext) ? this.logContext : { templateName: null, phase: 'render' };
  const messageName = displayName || name;
  if (!obj) {
    throw createLog('error', {
      message: `Function '${messageName}' is not defined`,
      lineno,
      colno,
      info: { code: 'UNDEFINED_FUNCTION', subject: name, phase: ctx.phase || 'render', templateName: ctx.templateName || 'inline' }
    });
  } else if (!isFunction(obj)) {
    throw createLog('error', {
      message: `'${messageName}' is not a function`,
      lineno,
      colno,
      info: { code: 'NOT_A_FUNCTION', subject: name, phase: ctx.phase || 'render', templateName: ctx.templateName || 'inline' }
    });
  }

  return obj.apply(context, args);
}

export function contextOrFrameLookup(context, frame, name) {
  let val = frame.lookup(name);
  return (val !== undefined) ?
    val :
    context.lookup(name);
}

export function lookup(ctx, key, defaultValue = undefined) {
  if (!ctx) return defaultValue;
  if (typeof ctx.lookup === 'function') {
    const val = ctx.lookup(key);
    return val !== undefined ? val : defaultValue;
  }
  const val = ctx[key];
  return val !== undefined ? val : defaultValue;
}

export function handleError(error, lineno, colno, runtime) {
  if (error.lineno !== undefined) {
    throw error;
  }

  const ctx = (this && this.logContext) ? this.logContext : { templateName: null, phase: 'render' };
  const info = {
    code: error.code,
    subject: error.subject,
    phase: error.phase || ctx.phase || 'render',
    templateName: ctx.templateName || 'inline'
  };

  let sourceMapData = null;
  if (runtime && runtime.sourceMapData) {
    sourceMapData = runtime.sourceMapData;
  }

  if (sourceMapData && isArray(sourceMapData) && sourceMapData.length > 0) {
    const sm = {
      mappings: sourceMapData,
      getOriginalPosition(compiledLine) {
        let best = null;
        for (const mapping of this.mappings) {
          if (compiledLine >= mapping.compiledLine) {
            best = mapping;
          }
        }
        if (best) {
          return {
            line: best.originalLine,
            col: best.originalCol || 0
          };
        }
        return { line: 0, col: 0 };
      }
    };
    const pos = sm.getOriginalPosition(lineno);
    throw createLog('error', {
      message: error.message || String(error),
      lineno: pos.line,
      colno: pos.col,
      info
    });
  }

  throw createLog('error', {
    message: error.message || String(error),
    lineno,
    colno,
    info
  });
}

export function fromIterator(arr) {
  if (typeof arr !== 'object' || arr === null || isArray(arr)) {
    return arr;
  } else if (Symbol.iterator in arr) {
    return Array.from(arr);
  } else {
    return arr;
  }
}

export function inOperator(key, val) {
  if (isArray(val) || isString(val)) {
    return val.includes(key);
  }
  if (isPlainObject(val)) {
    return key in val;
  }
  throw new Error(`Cannot use 'in' operator to search for '${key}' in ${typeof val}`);
}
