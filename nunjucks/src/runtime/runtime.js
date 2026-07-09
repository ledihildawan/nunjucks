import { TemplateError } from '../error/index.js';
import { SafeString } from './safe-string.js';
import { isArray, keys } from 'remeda';

const escapeHtml = (val) => Bun.escapeHTML(val).replace(/\\/g, '&#92;').replace(/&#x27;/g, '&#39;');

export { Frame } from './frame.js';
export { SafeString, copySafeness, markSafe } from './safe-string.js';
export { makeMacro, makeKeywordArgs, isKeywordArgs, getKeywordArgs, numArgs } from './macro.js';
export { memberLookup, optionalMemberLookup, slice, nullishCoalesce } from './member-access.js';
export { asyncEach, asyncAll } from './async-runtime.js';

export { isArray, keys } from 'remeda';

export function suppressValue(val, autoescape) {
  if (val && typeof val.then === 'function') {
    return val.then(v => suppressValue(v, autoescape));
  }

  val = (val !== undefined && val !== null) ? val : '';

  if (autoescape && !(val instanceof SafeString)) {
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

export function ensureDefined(val, lineno, colno, varName = null) {
  if (val === null || val === undefined) {
    const varMsg = varName ? ` '${varName}'` : '';
    throw new TemplateError(
      `attempted to output${varMsg} null or undefined value`,
      lineno,
      colno,
      { code: varName ? 'UNDEFINED_VARIABLE' : 'UNDEFINED_VALUE', subject: varName, phase: 'render' }
    );
  }
  return val;
}

export function callWrap(obj, name, context, args, lineno, colno) {
  if (!obj) {
    throw new TemplateError(
      'Unable to call `' + name + '`, which is undefined or falsey',
      lineno,
      colno,
      { code: 'UNDEFINED_FUNCTION', subject: name, phase: 'render' }
    );
  } else if (typeof obj !== 'function') {
    throw new TemplateError(
      'Unable to call `' + name + '`, which is not a function',
      lineno,
      colno,
      { code: 'NOT_A_FUNCTION', subject: name, phase: 'render' }
    );
  }

  return obj.apply(context, args);
}

export function contextOrFrameLookup(context, frame, name) {
  var val = frame.lookup(name);
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

  if (sourceMapData && Array.isArray(sourceMapData) && sourceMapData.length > 0) {
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
    return new TemplateError(error, pos.line, pos.col, info);
  }

  return new TemplateError(error, lineno, colno, info);
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
  if (Array.isArray(val) || typeof val === 'string') {
    return val.indexOf(key) !== -1;
  }
  if (val && typeof val === 'object') {
    return key in val;
  }
  throw new Error(`Cannot use "in" operator to search for "${key}" in unexpected types.`);
}
