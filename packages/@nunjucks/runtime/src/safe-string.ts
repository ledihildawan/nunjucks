// Extends the String object type (not the `string` primitive): a SafeString is
// an object built on String.prototype, so String's generic methods apply to it.
// biome-ignore lint/complexity/noBannedTypes: String is the object type here, and `string` is not a legal interface parent.
export interface SafeString extends String {
  val: string;
  valueOf: () => string;
  toString: () => string;
}

export const createSafeString = <T>(val: T): T extends string ? SafeString : T => {
  if (typeof val !== 'string') {
    return val as T extends string ? SafeString : T;
  }
  return Object.create(String.prototype, {
    val: { value: val },
    length: { value: val.length },
    valueOf: { value: () => val },
    toString: { value: () => val },
  }) as T extends string ? SafeString : T;
};

export const isSafeString = (val: unknown): val is SafeString => {
  return Boolean(val) && (val as { val?: unknown }).val !== undefined;
};

export const copySafeness = <T extends { toString: () => string }>(dest: unknown, target: T): SafeString | string => {
  if (dest && (dest as { val?: unknown }).val !== undefined) {
    return createSafeString(target.toString());
  }
  return target.toString();
};

export const markSafe = <T>(val: T): T extends string ? SafeString : T => {
  const type = typeof val;

  if (type === 'string') {
    return createSafeString(val);
  }
  if (type === 'function') {
    const fn = val as (...args: unknown[]) => unknown;
    return function wrapSafe(this: unknown, ...args: unknown[]): unknown {
      const ret = fn.apply(this, args);
      if (typeof ret === 'string') {
        return createSafeString(ret);
      }
      return ret;
    } as T extends string ? SafeString : T;
  }
  return val as T extends string ? SafeString : T;
};
