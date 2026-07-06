const ArrayProto = Array.prototype;
const ObjProto = Object.prototype;

const escapeMap = {
  '&': '&amp;',
  '"': '&quot;',
  '\'': '&#39;',
  '<': '&lt;',
  '>': '&gt;',
  '\\': '&#92;',
};

const escapeRegex = /[&"'<>\\]/g;

export function hasOwnProp(obj, k) {
  return ObjProto.hasOwnProperty.call(obj, k);
}

export function lookupEscape(ch) {
  return escapeMap[ch];
}

export function _prettifyError(path, withInternals, err, includeChain) {
  if (!err.Update) {
    err = new TemplateError(err);
  }
  err.Update(path, includeChain);

  if (!withInternals) {
    const old = err;
    err = new Error(old.message);
    err.name = old.name;
    err.lineno = old.lineno;
    err.colno = old.colno;
  }

  return err;
}

export class TemplateError extends Error {
  constructor(message, lineno, colno) {
    super(message);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    this.name = 'Template render error';
    this.lineno = lineno;
    this.colno = colno;
    this.firstUpdate = true;
  }

  Update(path, includeChain) {
    let msg = '(' + (path || 'unknown path') + ')';
    if (this.firstUpdate) {
      if (this.lineno && this.colno) {
        msg += ` [Line ${this.lineno}, Column ${this.colno}]`;
      } else if (this.lineno) {
        msg += ` [Line ${this.lineno}]`;
      }
    }
    if (includeChain && this.firstUpdate) {
      msg += `\n   (included from ${includeChain.parentTmpl} at line ${includeChain.parentLineno})`;
    }
    msg += '\n ';
    if (this.firstUpdate) {
      msg += ' ';
    }
    this.message = msg + (this.message || '');
    this.firstUpdate = false;
    return this;
  }
}

export function escape(val) {
  return val.replace(escapeRegex, lookupEscape);
}

export function isFunction(obj) {
  return ObjProto.toString.call(obj) === '[object Function]';
}

export function isArray(obj) {
  return ObjProto.toString.call(obj) === '[object Array]';
}

export function isString(obj) {
  return ObjProto.toString.call(obj) === '[object String]';
}

export function isObject(obj) {
  return ObjProto.toString.call(obj) === '[object Object]';
}

export function _prepareAttributeParts(attr) {
  if (!attr) {
    return [];
  }
  if (typeof attr === 'string') {
    return attr.split('.');
  }
  return [attr];
}

export function getAttrGetter(attribute) {
  const parts = _prepareAttributeParts(attribute);
  return function attrGetter(item) {
    let _item = item;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (hasOwnProp(_item, part)) {
        _item = _item[part];
      } else {
        return undefined;
      }
    }
    return _item;
  };
}

export function groupBy(obj, val, throwOnUndefined) {
  const result = {};
  const iterator = isFunction(val) ? val : getAttrGetter(val);
  for (let i = 0; i < obj.length; i++) {
    const value = obj[i];
    const key = iterator(value, i);
    if (key === undefined && throwOnUndefined === true) {
      throw new TypeError(`groupby: attribute "${val}" resolved to undefined`);
    }
    (result[key] || (result[key] = [])).push(value);
  }
  return result;
}

export function toArray(obj) {
  return Array.prototype.slice.call(obj);
}

export function without(array) {
  const result = [];
  if (!array) {
    return result;
  }
  const length = array.length;
  const contains = toArray(arguments).slice(1);
  let index = -1;

  while (++index < length) {
    if (indexOf(contains, array[index]) === -1) {
      result.push(array[index]);
    }
  }
  return result;
}

export function repeat(char_, n) {
  let str = '';
  for (let i = 0; i < n; i++) {
    str += char_;
  }
  return str;
}

export function each(obj, func, context) {
  if (obj == null) {
    return;
  }

  if (ArrayProto.forEach && obj.forEach === ArrayProto.forEach) {
    obj.forEach(func, context);
  } else if (obj.length === +obj.length) {
    for (let i = 0, l = obj.length; i < l; i++) {
      func.call(context, obj[i], i, obj);
    }
  }
}

export function map(obj, func) {
  const results = [];
  if (obj == null) {
    return results;
  }

  if (ArrayProto.map && obj.map === ArrayProto.map) {
    return obj.map(func);
  }

  for (let i = 0; i < obj.length; i++) {
    results[results.length] = func(obj[i], i);
  }

  if (obj.length === +obj.length) {
    results.length = obj.length;
  }

  return results;
}

export async function asyncIter(arr, iter) {
  for (let i = 0; i < arr.length; i++) {
    await iter(arr[i], i);
  }
}

export async function asyncFor(obj, iter) {
  const keys = keys_(obj || {});
  const len = keys.length;
  for (let i = 0; i < len; i++) {
    const k = keys[i];
    await iter(k, obj[k], i, len);
  }
}

export function indexOf(arr, searchElement, fromIndex) {
  return Array.prototype.indexOf.call(arr || [], searchElement, fromIndex);
}

export function keys_(obj) {
  const arr = [];
  for (let k in obj) {
    if (hasOwnProp(obj, k)) {
      arr.push(k);
    }
  }
  return arr;
}

export const keys = keys_;

export function _entries(obj) {
  return keys_(obj).map((k) => [k, obj[k]]);
}

export function _values(obj) {
  return keys_(obj).map((k) => obj[k]);
}

export function extend(obj1, obj2) {
  obj1 = obj1 || {};
  keys_(obj2).forEach(k => {
    obj1[k] = obj2[k];
  });
  return obj1;
}

export function inOperator(key, val) {
  if (isArray(val) || isString(val)) {
    return val.indexOf(key) !== -1;
  } else if (isObject(val)) {
    return key in val;
  }
  throw new Error('Cannot use "in" operator to search for "'
    + key + '" in unexpected types.');
}
