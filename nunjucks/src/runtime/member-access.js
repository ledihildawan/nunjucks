export function memberLookup(obj, val) {
  if (obj === undefined || obj === null) {
    return undefined;
  }

  if (typeof obj[val] === 'function') {
    return (...args) => obj[val].apply(obj, args);
  }

  return obj[val];
}

export function optionalMemberLookup(obj, val) {
  if (obj === undefined || obj === null) {
    return undefined;
  }

  if (typeof obj[val] === 'function') {
    return (...args) => obj[val].apply(obj, args);
  }

  return obj[val];
}

export function slice(arr, start, stop, step) {
  if (step === 0) {
    throw new Error('slice step cannot be 0');
  }

  const len = arr.length;

  if (start === null || start === undefined) {
    start = (step < 0) ? len - 1 : 0;
  }
  if (stop === null || stop === undefined) {
    stop = (step < 0) ? -1 : len;
  }

  const normalizeStart = (idx) => {
    if (idx < 0) return Math.max(0, len + idx);
    return Math.min(len, idx);
  };

  start = normalizeStart(start);

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
    const result = [];
    for (let i = start; i >= 0 && i > stop; i += step) {
      result.push(arr[i]);
    }
    return result;
  }
}

export function nullishCoalesce(left, right) {
  return (left !== undefined && left !== null) ? left : right;
}
