import picocolors from 'picocolors';
import { createTemplateError } from '../error/index.js';
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
import { createUndefinedWarning, toConsoleString } from '../warning/index.js';
import { toContext, createIsolatedContext, createForkedContext } from './render-context.js';

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
    if (undefinedMode === 'strict') {
      throw createTemplateError(
        `attempted to output${varName ? ` '${varName}'` : ''} null or undefined value`,
        lineno,
        colno,
        { code: varName ? 'UNDEFINED_VARIABLE' : 'UNDEFINED_VALUE', subject: varName, phase: 'render' }
      );
    }

    if (undefinedMode === 'debug') {
      const warning = createUndefinedWarning(varName, lineno, colno, templateName, undefinedMode);
      console.warn(toConsoleString(warning));
    }

    return 'undefined';
  }
  return val;
}

export function callWrap(obj, name, displayName, context, args, lineno, colno) {
  const messageName = displayName || name;
  if (!obj) {
    throw createTemplateError(
      `Unable to call \`${messageName}\`, which is undefined or falsey`,
      lineno,
      colno,
      { code: 'UNDEFINED_FUNCTION', subject: name, phase: 'render' }
    );
  } else if (!isFunction(obj)) {
    throw createTemplateError(
      `Unable to call \`${messageName}\`, which is not a function`,
      lineno,
      colno,
      { code: 'NOT_A_FUNCTION', subject: name, phase: 'render' }
    );
  }

  return obj.apply(context, args);
}

export function contextOrFrameLookup(context, frame, name) {
  let val = frame.lookup(name);
  return (val !== undefined) ?
    val :
    context.lookup(name);
}

export function handleError(error, lineno, colno, sourceMapData) {
  if (error.lineno !== undefined) {
    return error;
  }

  const info = {
    code: error.code,
    subject: error.subject,
    phase: error.phase || 'render'
  };

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
    return createTemplateError(error, pos.line, pos.col, info);
  }

  return createTemplateError(error, lineno, colno, info);
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
  throw new Error(`Cannot use "in" operator to search for \`${key}\` in unexpected types.`);
}
