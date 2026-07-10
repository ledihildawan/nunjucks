export function createSafeString(val) {
  if (typeof val !== 'string') {
    return val;
  }

  return Object.create(String.prototype, {
    val: { value: val },
    length: { value: val.length },
    valueOf: { value: () => val },
    toString: { value: () => val },
  });
}

export function isSafeString(val) {
  return val && val.val !== undefined;
}

export function copySafeness(dest, target) {
  if (dest && dest.val !== undefined) {
    return createSafeString(target);
  }
  return target.toString();
}

export function markSafe(val) {
  var type = typeof val;

  if (type === 'string') {
    return createSafeString(val);
  } else if (type !== 'function') {
    return val;
  } else {
    return function wrapSafe(args) {
      var ret = val.apply(this, arguments);
      if (typeof ret === 'string') {
        return createSafeString(ret);
      }
      return ret;
    };
  }
}
