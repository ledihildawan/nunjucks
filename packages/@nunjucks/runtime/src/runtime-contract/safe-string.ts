// biome-ignore lint/complexity/noBannedTypes: String is the object type here, and `string` is not a legal interface parent.
export interface SafeString extends String {
  val: string;
  valueOf: () => string;
  toString: () => string;
}

export const createSafeString = <T>(value: T): T extends string ? SafeString : T => {
  if (typeof value !== 'string') {
    return value as T extends string ? SafeString : T;
  }
  return Object.create(String.prototype, {
    val: { value: value },
    length: { value: value.length },
    valueOf: { value: () => value },
    toString: { value: () => value },
  }) as T extends string ? SafeString : T;
};

export const isSafeString = (value: unknown): value is SafeString => {
  return Boolean(value) && (value as { val?: unknown }).val !== undefined;
};

export const copySafeness = <T extends { toString: () => string }>(
  dest: unknown,
  target: T
): SafeString | string => {
  if (dest && (dest as { val?: unknown }).val !== undefined) {
    return createSafeString(target.toString());
  }
  return target.toString();
};

export const markSafe = <T>(value: T): T extends string ? SafeString : T => {
  const type = typeof value;

  if (type === 'string') {
    return createSafeString(value);
  }
  if (type === 'function') {
    const fn = value as (...args: unknown[]) => unknown;
    return function wrapSafe<A extends unknown[]>(this: unknown, ...args: A): unknown {
      const returnValue = fn.apply(this, args);
      if (typeof returnValue === 'string') {
        return createSafeString(returnValue);
      }
      return returnValue;
    } as T extends string ? SafeString : T;
  }
  return value as T extends string ? SafeString : T;
};
