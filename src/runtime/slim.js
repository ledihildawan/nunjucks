const escapeHtml = (val) => String(val)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')
  .replace(/\\/g, '&#92;');

export function suppressValue(val, autoescape) {
  if (val && typeof val.then === 'function') {
    return val.then(v => suppressValue(v, autoescape));
  }

  val = (val !== undefined && val !== null) ? val : '';

  if (autoescape && typeof val === 'string') {
    val = escapeHtml(val);
  }

  return val;
}

export function awaitValue(val) {
  if (val && typeof val.then === 'function') {
    return val.then(v => v);
  }
  return val;
}

export function contextOrFrameLookup(context, frame, name) {
  const val = frame && frame.lookup(name);
  return (val !== undefined) ? val : context.lookup(name);
}

export function memberLookup(obj, prop) {
  if (obj == null) return undefined;
  return obj[prop];
}

export function optionalMemberLookup(obj, prop) {
  if (obj == null) return [undefined, true];
  const val = obj[prop];
  return [val, val === undefined];
}

export function slice(obj, start, end) {
  if (typeof obj === 'string') {
    return obj.slice(start, end);
  }
  if (Array.isArray(obj)) {
    return obj.slice(start, end);
  }
  return null;
}

export function nullishCoalesce(obj, prop, defaultValue) {
  const val = obj[prop];
  return val !== undefined && val !== null ? val : defaultValue;
}

export function inOperator(key, val) {
  if (Array.isArray(val) || typeof val === 'string') {
    return val.indexOf(key) !== -1;
  }
  if (val && typeof val === 'object') {
    return key in val;
  }
  return false;
}

export function fromIterator(arr) {
  if (typeof arr !== 'object' || arr === null || Array.isArray(arr)) {
    return arr;
  } else if (Symbol.iterator in arr) {
    return Array.from(arr);
  } else {
    return arr;
  }
}

export function isArray(arr) {
  return Array.isArray(arr);
}

export function keys(obj) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.keys(obj);
}

export function copySafeness(dest, src) {
  return src;
}

export function markSafe(val) {
  return String(val);
}

export function SafeString(val) {
  return String(val);
}

export function isSafeString(val) {
  return false;
}

export function handleError(error, lineno, colno) {
  if (error.lineno !== undefined) {
    return error;
  }
  const err = new Error(error.message);
  err.lineno = lineno;
  err.colno = colno;
  return err;
}

export function callWrap(obj, name, context, args, lineno, colno) {
  if (!obj) {
    const err = new Error(`Unable to call \`${name}\`, which is undefined or falsey`);
    err.lineno = lineno;
    err.colno = colno;
    throw err;
  } else if (typeof obj !== 'function') {
    const err = new Error(`Unable to call \`${name}\`, which is not a function`);
    err.lineno = lineno;
    err.colno = colno;
    throw err;
  }
  return obj.apply(context, args);
}

export function getTemplateName(template) {
  return template;
}

export function isObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

export function safeString(val) {
  return String(val);
}

export function copySafeString(obj) {
  return String(obj);
}

export function coerce(val) {
  return val;
}

export function undefinedValue() {
  return undefined;
}

export function frameLookup(ctx, frame, name) {
  const val = frame && frame.lookup(name);
  if (val !== undefined) return val;
  return ctx.get(name);
}

export function getSymbols() {
  return null;
}

export function merge(src, dest) {
  for (const key in src) {
    if (Object.prototype.hasOwnProperty.call(src, key)) {
      dest[key] = src[key];
    }
  }
  return dest;
}

export const uniq = (arr) => [...new Set(arr)];
export const toArray = (val) => Array.isArray(val) ? val : [val];
export const capitalize = (val) => String(val).charAt(0).toUpperCase() + String(val).slice(1);
export const upper = (val) => String(val).toUpperCase();
export const lower = (val) => String(val).toLowerCase();
export const title = (val) => String(val).replace(/\b\w/g, c => c.toUpperCase());
export const trim = (val) => String(val).trim();
export const truncate = (val, len) => String(val).slice(0, len);
export const round = (val, precision) => Number(Number(val).toFixed(precision));
export const sum = (arr) => arr.reduce((a, b) => a + Number(b), 0);
export const groupBy = (arr, attr) => {
  const result = {};
  for (const item of arr) {
    const key = typeof attr === 'function' ? attr(item) : item[attr];
    (result[key] = result[key] || []).push(item);
  }
  return result;
};

export default {
  suppressValue,
  awaitValue,
  contextOrFrameLookup,
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
  inOperator,
  fromIterator,
  isArray,
  keys,
  copySafeness,
  markSafe,
  SafeString,
  isSafeString,
  handleError,
  callWrap,
  isObject,
  safeString,
  copySafeString,
  coerce,
  undefinedValue,
  frameLookup,
  merge,
  uniq,
  toArray,
  capitalize,
  upper,
  lower,
  title,
  trim,
  truncate,
  round,
  sum,
  groupBy,
};
