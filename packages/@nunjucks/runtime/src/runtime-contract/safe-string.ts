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

// WHY: structural verification instead of a bare `.val` duck check — a plain context object
// with a `val` field must not claim pre-escaped status and bypass autoescape
// (suppress-value.ts). createSafeString owns val/length/valueOf/toString as NON-enumerable
// data properties; descriptor checks are realm-independent, so SafeStrings built by another
// copy of this module still pass. A full Object.defineProperty mimic requires code execution,
// which the sandbox already forbids — data-only context payloads cannot forge the shape.
const isOwnNonEnumerableDataProperty = (
  value: object,
  key: string,
  expectedType: 'string' | 'number' | 'function'
): boolean => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return (
    descriptor !== undefined &&
    !descriptor.enumerable &&
    descriptor.get === undefined &&
    descriptor.set === undefined &&
    typeof descriptor.value === expectedType
  );
};

export const isSafeString = (value: unknown): value is SafeString => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if ((value as { val?: unknown }).val === undefined) {
    return false;
  }
  return (
    isOwnNonEnumerableDataProperty(value, 'val', 'string') &&
    isOwnNonEnumerableDataProperty(value, 'length', 'number') &&
    isOwnNonEnumerableDataProperty(value, 'toString', 'function') &&
    isOwnNonEnumerableDataProperty(value, 'valueOf', 'function')
  );
};

export const copySafeness = <T extends { toString: () => string }>(
  dest: unknown,
  target: T
): SafeString | string => {
  if (isSafeString(dest)) {
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
