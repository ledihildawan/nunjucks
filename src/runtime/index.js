import { createLog, normalizeErrorMetadata } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log/error/messages';
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
      const errorDef = varName ? ERROR_DEFINITIONS.UNDEFINED_VARIABLE : { name: 'UNDEFINED_VALUE', message: () => 'Undefined value', pattern: /./ };
      throw createLog('error', errorDef, { name: varName }, varName, { lineno, colno, phase: ctx.phase || 'render', templateName: effectiveTemplateName, lineBase: 'zero' });
    }

    if (undefinedMode === 'debug') {
      const warning = createLog('warning', {
        name: 'UNDEFINED_VARIABLE',
        message: () => varName ? `Variable '${varName}' is undefined or null` : 'Variable is undefined or null',
        pattern: /./
      }, {}, varName, { lineno, colno, phase: ctx.phase || 'render', templateName: effectiveTemplateName, undefinedMode, varName, lineBase: 'zero' });
      if (this && this.__warnings__) {
        this.__warnings__.push(warning);
      } else {
        console.warn(warning.output({ verbosity: 'medium', dev: true }));
      }
    }

    return 'undefined';
  }
  return val;
}

export function callWrap(obj, name, displayName, context, args, lineno, colno) {
  const ctx = (this && this.logContext) ? this.logContext : { templateName: null, phase: 'render' };
  const messageName = displayName || name;
  const reservedKeywordContexts = {
    'caller': 'macro context ({% call %} block)',
    'super': 'block that extends a parent template'
  };
  if (reservedKeywordContexts[name]) {
    throw createLog('error', ERROR_DEFINITIONS.RESERVED_KEYWORD_CONTEXT, { name }, name, { lineno, colno, phase: ctx.phase || 'render', templateName: ctx.templateName || 'inline', lineBase: 'zero' });
  }
  if (!obj) {
    throw createLog('error', ERROR_DEFINITIONS.UNDEFINED_FUNCTION, { name: messageName }, name, { lineno, colno, phase: ctx.phase || 'render', templateName: ctx.templateName || 'inline', lineBase: 'zero' });
  } else if (!isFunction(obj)) {
    throw createLog('error', ERROR_DEFINITIONS.NOT_A_FUNCTION, { name: messageName }, name, { lineno, colno, phase: ctx.phase || 'render', templateName: ctx.templateName || 'inline', lineBase: 'zero' });
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
  const ctx = (this && this.logContext) ? this.logContext : { templateName: null, phase: 'render', renderContext: null };
  const metadata = normalizeErrorMetadata(error, {
    lineno,
    colno,
    phase: ctx.phase || 'render',
    templateName: ctx.templateName || 'inline',
    renderContext: ctx.renderContext || null,
    lineBase: 'zero'
  });

  if (metadata.lineno !== null && error instanceof Error && error.lineno !== undefined && error.lineno !== null) {
    throw error;
  }

  throw createLog('error', {
    name: metadata.code || 'RUNTIME_ERROR',
    message: () => metadata.message,
    pattern: /./
  }, {}, metadata.subject, {
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
    lineBase: metadata.lineBase
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

export function inOperator(key, val, lineno = null, colno = null) {
  if (isArray(val) || isString(val)) {
    return val.includes(key);
  }
  if (isPlainObject(val)) {
    return key in val;
  }
  const ctx = (this && this.logContext) ? this.logContext : { templateName: 'inline', phase: 'render', renderContext: null };
  throw createLog('error', ERROR_DEFINITIONS.IN_OPERATOR, { key: String(key), type: typeof val }, String(key), { lineno, colno, phase: ctx.phase || 'render', templateName: ctx.templateName || 'inline', lineBase: 'zero' });
}
