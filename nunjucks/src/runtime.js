import lib from './lib.js';
var arrayFrom = Array.from;
var supportsIterators = (
  typeof Symbol === 'function' && Symbol.iterator && typeof arrayFrom === 'function'
);

class Frame {
  constructor(parent, isolateWrites) {
    this.variables = Object.create(null);
    this.parent = parent;
    this.topLevel = false;
    this.isolateWrites = isolateWrites;
  }

  set(name, val, resolveUp) {
    var parts = name.split('.');
    var obj = this.variables;
    var frame = this;

    if (resolveUp) {
      if ((frame = this.resolve(parts[0], true))) {
        frame.set(name, val);
        return;
      }
    }

    for (let i = 0; i < parts.length - 1; i++) {
      const id = parts[i];

      if (!obj[id]) {
        obj[id] = {};
      }
      obj = obj[id];
    }

    obj[parts[parts.length - 1]] = val;
  }

  get(name) {
    var val = this.variables[name];
    if (val !== undefined) {
      return val;
    }
    return null;
  }

  lookup(name) {
    var p = this.parent;
    var val = this.variables[name];
    if (val !== undefined) {
      return val;
    }
    return p && p.lookup(name);
  }

  resolve(name, forWrite) {
    var p = (forWrite && this.isolateWrites) ? undefined : this.parent;
    var val = this.variables[name];
    if (val !== undefined) {
      return this;
    }
    return p && p.resolve(name);
  }

  push(isolateWrites) {
    return new Frame(this, isolateWrites);
  }

  pop() {
    return this.parent;
  }
}

function makeMacro(argNames, kwargNames, func) {
  return function macro(...macroArgs) {
    var argCount = numArgs(macroArgs);
    var args;
    var kwargs = getKeywordArgs(macroArgs);

    if (argCount > argNames.length) {
      args = macroArgs.slice(0, argNames.length);

      macroArgs.slice(args.length, argCount).forEach((val, i) => {
        if (i < kwargNames.length) {
          kwargs[kwargNames[i]] = val;
        }
      });
      args.push(kwargs);
    } else if (argCount < argNames.length) {
      args = macroArgs.slice(0, argCount);

      for (let i = argCount; i < argNames.length; i++) {
        const arg = argNames[i];

        args.push(kwargs[arg]);
        delete kwargs[arg];
      }
      args.push(kwargs);
    } else {
      args = macroArgs;
    }

    return func.apply(this, args);
  };
}

function makeKeywordArgs(obj) {
  obj.__keywords = true;
  return obj;
}

function isKeywordArgs(obj) {
  return obj && Object.prototype.hasOwnProperty.call(obj, '__keywords');
}

function getKeywordArgs(args) {
  var len = args.length;
  if (len) {
    const lastArg = args[len - 1];
    if (isKeywordArgs(lastArg)) {
      return lastArg;
    }
  }
  return {};
}

function numArgs(args) {
  var len = args.length;
  if (len === 0) {
    return 0;
  }

  const lastArg = args[len - 1];
  if (isKeywordArgs(lastArg)) {
    return len - 1;
  } else {
    return len;
  }
}

function SafeString(val) {
  if (typeof val !== 'string') {
    return val;
  }

  this.val = val;
  this.length = val.length;
}

SafeString.prototype = Object.create(String.prototype, {
  length: {
    writable: true,
    configurable: true,
    value: 0
  }
});
SafeString.prototype.valueOf = function valueOf() {
  return this.val;
};
SafeString.prototype.toString = function toString() {
  return this.val;
};

function copySafeness(dest, target) {
  if (dest instanceof SafeString) {
    return new SafeString(target);
  }
  return target.toString();
}

function markSafe(val) {
  var type = typeof val;

  if (type === 'string') {
    return new SafeString(val);
  } else if (type !== 'function') {
    return val;
  } else {
    return function wrapSafe(args) {
      var ret = val.apply(this, arguments);

      if (typeof ret === 'string') {
        return new SafeString(ret);
      }

      return ret;
    };
  }
}

function suppressValue(val, autoescape) {
  val = (val !== undefined && val !== null) ? val : '';

  if (autoescape && !(val instanceof SafeString)) {
    val = lib.escape(val.toString());
  }

  return val;
}

function awaitValue(val) {
  if (val && typeof val.then === 'function') {
    return val.then(v => v);
  }
  return val;
}

function ensureDefined(val, lineno, colno) {
  if (val === null || val === undefined) {
    throw new lib.TemplateError(
      'attempted to output null or undefined value',
      lineno + 1,
      colno + 1
    );
  }
  return val;
}

function memberLookup(obj, val) {
  if (obj === undefined || obj === null) {
    return undefined;
  }

  if (typeof obj[val] === 'function') {
    return (...args) => obj[val].apply(obj, args);
  }

  return obj[val];
}

function optionalMemberLookup(obj, val) {
  if (obj === undefined || obj === null) {
    return undefined;
  }

  if (typeof obj[val] === 'function') {
    return (...args) => obj[val].apply(obj, args);
  }

  return obj[val];
}

function slice(arr, start, stop, step) {
  if (step === 0) {
    throw new Error('slice step cannot be 0');
  }

  const len = arr.length;

  // Handle null/undefined start and stop based on step direction
  if (start === null || start === undefined) {
    start = (step < 0) ? len - 1 : 0;
  }
  if (stop === null || stop === undefined) {
    stop = (step < 0) ? -1 : len;
  }

  // Handle negative indices for start only (stop can be -1 for negative step)
  const normalizeStart = (idx) => {
    if (idx < 0) return Math.max(0, len + idx);
    return Math.min(len, idx);
  };

  start = normalizeStart(start);

  // Handle step
  if (step === null || step === undefined || step === 1) {
    return arr.slice(start, stop);
  }

  if (step > 0) {
    const result = [];
    for (let i = start; i < stop; i += step) {
      result.push(arr[i]);
    }
    return result;
  } else {
    // Negative step
    const result = [];
    // stop < 0 means go past 0, so we use > 0 condition
    for (let i = start; i >= 0 && i > stop; i += step) {
      result.push(arr[i]);
    }
    return result;
  }
}

function nullishCoalesce(left, right) {
  return (left !== undefined && left !== null) ? left : right;
}

function callWrap(obj, name, context, args) {
  if (!obj) {
    throw new Error('Unable to call `' + name + '`, which is undefined or falsey');
  } else if (typeof obj !== 'function') {
    throw new Error('Unable to call `' + name + '`, which is not a function');
  }

  return obj.apply(context, args);
}

function contextOrFrameLookup(context, frame, name) {
  var val = frame.lookup(name);
  return (val !== undefined) ?
    val :
    context.lookup(name);
}

function handleError(error, lineno, colno) {
  if (error.lineno) {
    return error;
  } else {
    return new lib.TemplateError(error, lineno, colno);
  }
}

async function asyncEach(arr, dimen, iter) {
  if (lib.isArray(arr)) {
    const len = arr.length;

    for (let i = 0; i < len; i++) {
      const item = arr[i];
      switch (dimen) {
        case 1:
          await iter(item, i, len);
          break;
        case 2:
          await iter(item[0], item[1], i, len);
          break;
        case 3:
          await iter(item[0], item[1], item[2], i, len);
          break;
        default:
          item.push(i, len);
          await iter.apply(this, item);
      }
    }
  } else {
    const keys = lib.keys(arr || {});
    const len = keys.length;
    for (let i = 0; i < len; i++) {
      const k = keys[i];
      await iter(k, arr[k], i, len);
    }
  }
}

async function asyncAll(arr, dimen, func) {
  const outputArr = [];

  if (lib.isArray(arr)) {
    const len = arr.length;

    if (len === 0) {
      return '';
    }

    for (let i = 0; i < len; i++) {
      const item = arr[i];

      switch (dimen) {
        case 1:
          outputArr[i] = await func(item, i, len);
          break;
        case 2:
          outputArr[i] = await func(item[0], item[1], i, len);
          break;
        case 3:
          outputArr[i] = await func(item[0], item[1], item[2], i, len);
          break;
        default:
          item.push(i, len);
          outputArr[i] = await func.apply(this, item);
      }
    }
  } else {
    const keys = lib.keys(arr || {});
    const len = keys.length;

    if (len === 0) {
      return '';
    }

    for (let i = 0; i < len; i++) {
      const k = keys[i];
      outputArr[i] = await func(k, arr[k], i, len);
    }
  }

  return outputArr.join('');
}

function fromIterator(arr) {
  if (typeof arr !== 'object' || arr === null || lib.isArray(arr)) {
    return arr;
  } else if (supportsIterators && Symbol.iterator in arr) {
    return arrayFrom(arr);
  } else {
    return arr;
  }
}

export {
  Frame,
  makeMacro,
  makeKeywordArgs,
  numArgs,
  suppressValue,
  ensureDefined,
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
  contextOrFrameLookup,
  callWrap,
  handleError,
  SafeString,
  copySafeness,
  markSafe,
  asyncEach,
  asyncAll,
  fromIterator,
  awaitValue
};

export const isArray = lib.isArray;
export const keys = lib.keys;
export const inOperator = lib.inOperator;
