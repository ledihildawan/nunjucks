export const isNonNullish = <T>(val: T): val is NonNullable<T> => val !== null && val !== undefined;

export const isFunction = (val: unknown): val is Function => typeof val === 'function';

export const isString = (val: unknown): val is string => typeof val === 'string';

export const isNumber = (val: unknown): val is number => typeof val === 'number';

export const isBoolean = (val: unknown): val is boolean => typeof val === 'boolean';

export const isArray = <T>(val: unknown): val is T[] => Array.isArray(val);

export const isRecord = (val: unknown): val is Record<string, unknown> =>
  isNonNullish(val) && typeof val === 'object' && !isArray(val);

export const isPromise = <T>(val: unknown): val is Promise<T> =>
  isNonNullish(val) && isFunction((val as Promise<T>).then);

export const hasOwn = <O extends object, K extends PropertyKey>(
  obj: O,
  key: K
): obj is O & Record<K, unknown> => Object.hasOwn(obj, key);

export const clamp = (val: number, min: number, max: number): number =>
  Math.min(Math.max(val, min), max);

export const omit = <O extends object, K extends keyof O>(
  obj: O,
  keys: K[]
): Omit<O, K> => {
  const result = { ...obj };
  for (const key of keys) delete result[key];
  return result;
};

export const pick = <O extends object, K extends keyof O>(
  obj: O,
  keys: K[]
): Pick<O, K> => {
  const result = {} as Pick<O, K>;
  for (const key of keys) result[key] = obj[key];
  return result;
};

export const groupBy = <T>(
  arr: T[],
  keyFn: (item: T) => string
): Record<string, T[]> => {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = keyFn(item);
    (result[key] ??= []).push(item);
  }
  return result;
};

export const uniqueBy = <T>(arr: T[], keyFn: (item: T) => unknown): T[] => {
  const seen = new Set<unknown>();
  return arr.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const chunk = <T>(arr: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

export const memoize = <A extends unknown[], R>(
  fn: (...args: A) => R
): ((...args: A) => R) => {
  const cache = new Map<string, R>();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key)!;
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

export const pipe = <A, B, C>(
  fn1: (a: A) => B,
  fn2: (b: B) => C
): ((a: A) => C) => a => fn2(fn1(a));

export const compose = <A, B, C>(
  fn2: (b: B) => C,
  fn1: (a: A) => B
): ((a: A) => C) => a => fn2(fn1(a));

export const tap = <T>(fn: (val: T) => void) => (val: T): T => {
  fn(val);
  return val;
};
