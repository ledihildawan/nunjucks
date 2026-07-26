// SAFE STRING - Marks strings as already escaped for autoescape handling
// Extends the String object type (not the `string` primitive): a SafeString is
// an object built on String.prototype, so String's generic methods apply to it.
// biome-ignore lint/complexity/noBannedTypes: String is the object type here, and `string` is not a legal interface parent.
export interface SafeString extends String {
  val: string;
  valueOf: () => string;
  toString: () => string;
}

export function createSafeString(val: unknown): unknown {
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

export function isSafeString(val: unknown): boolean {
  return Boolean(val) && (val as { val?: unknown }).val !== undefined;
}

export function copySafeness(dest: unknown, target: { toString: () => string }): unknown {
  if (dest && (dest as { val?: unknown }).val !== undefined) {
    return createSafeString(target);
  }
  return target.toString();
}

export function markSafe(val: unknown): unknown {
  const type = typeof val;

  if (type === 'string') {
    return createSafeString(val);
  }if (type === 'function') {
    const fn = val as (...args: unknown[]) => unknown;
    return function wrapSafe(this: unknown, ...args: unknown[]): unknown {
      const ret = fn.apply(this, args);
      if (typeof ret === 'string') {
        return createSafeString(ret);
      }
      return ret;
    };
  } 
    return val;
}
