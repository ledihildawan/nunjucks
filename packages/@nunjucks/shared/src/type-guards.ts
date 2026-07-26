// Imported for use inside this module.
import { isNonNullish, isFunction, isArray, keys, filter as filterArray } from 'remeda';

// Re-exported straight through, so consumers get remeda's own bindings rather
// than a local alias that hides where they came from.
export {
  isNonNullish,
  isFunction,
  isString,
  isNumber,
  isBoolean,
  isArray,
  isPlainObject,
  isNullish,
  pipe,
  mapValues,
  fromEntries,
  keys,
  values,
  entries,
  forEachObj,
  unique,
  chunk,
  filter as filterArray,
  map as mapArray,
  reduce as reduceArray,
} from 'remeda';

type Predicate<T> = (value: T) => boolean;

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
  keysToOmit: K[]
): Omit<O, K> => {
  const result = { ...obj } as Record<string, unknown>;
  for (const key of keysToOmit) {
    delete result[key as string];
  }
  return result as unknown as Omit<O, K>;
};

export const pick = <O extends object, K extends keyof O>(
  obj: O,
  keysToPick: K[]
): Pick<O, K> => {
  const result = {} as Pick<O, K>;
  for (const key of keysToPick) {
    result[key] = obj[key];
  }
  return result;
};

export const groupBy = <T>(
  arr: T[],
  keyFn: (item: T) => string
): Record<string, T[]> => {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key]?.push(item);
  }
  return result;
};

export const uniqueBy = <T>(arr: T[], keyFn: (item: T) => unknown): T[] => {
  const seen = new Set<unknown>();
  return filterArray(arr, item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

export const memoize = <A extends unknown[], R>(
  fn: (...args: A) => R
): ((...args: A) => R) => {
  const cache = new Map<string, R>();
  return (...args: A) => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

export const compose = <A, B, C>(
  fn2: (b: B) => C,
  fn1: (a: A) => B
): ((a: A) => C) => a => fn2(fn1(a));

export const tap = <T>(fn: (val: T) => void) => (val: T): T => {
  fn(val);
  return val;
};

export const debounce = <A extends unknown[], R>(
  fn: (...args: A) => R,
  ms: number
): ((...args: A) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: A) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
};

export const retry = async <T>(
  fn: () => Promise<T>,
  attempts = 3,
  delay = 100
): Promise<T> => {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error('Unreachable');
};

export const mapObject = <K extends string, V, R>(
  obj: Record<K, V>,
  fn: (value: V, key: K) => R
): Record<K, R> => {
  const result = {} as Record<K, R>;
  for (const key of keys(obj) as K[]) {
    result[key] = fn(obj[key], key);
  }
  return result;
};

export const filterObject = <K extends string, V>(
  obj: Record<K, V>,
  fn: (value: V, key: K) => boolean
): Partial<Record<K, V>> => {
  const result: Partial<Record<K, V>> = {};
  for (const key of keys(obj) as K[]) {
    if (fn(obj[key], key)) {
      result[key] = obj[key];
    }
  }
  return result;
};

export const flatten = <T>(arr: T[][]): T[] => arr.flat();

export const zip = <T, U>(a: T[], b: U[]): [T, U][] => {
  const minLen = Math.min(a.length, b.length);
  const result: [T, U][] = [];
  for (let i = 0; i < minLen; i += 1) {
    const aItem = a[i];
    const bItem = b[i];
    if (aItem !== undefined && bItem !== undefined) {
      result.push([aItem, bItem]);
    }
  }
  return result;
};

export const partition = <T>(arr: T[], fn: Predicate<T>): [T[], T[]] => {
  const pass: T[] = [];
  const fail: T[] = [];
  for (const item of arr) {
    if (fn(item)) {
      pass.push(item);
    } else {
      fail.push(item);
    }
  }
  return [pass, fail];
};
