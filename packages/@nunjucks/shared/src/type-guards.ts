// Imported for use inside this module.
import { isNonNullish, isFunction, isArray, filter as filterArray, map as mapArray, reduce as reduceArray, pipe, entries, fromEntries } from 'remeda';

// Re-exported straight through, so consumers get remeda's own bindings rather
// than a local alias that hides where they came from.
type Predicate<T> = (value: T) => boolean;

const isRecord = (val: unknown): val is Record<string, unknown> =>
  isNonNullish(val) && typeof val === 'object' && !isArray(val);

const isPromise = <T>(val: unknown): val is Promise<T> =>
  isNonNullish(val) && isFunction((val as Promise<T>).then);

const hasOwn = <O extends object, K extends PropertyKey>(
  obj: O,
  key: K
): obj is O & Record<K, unknown> => Object.hasOwn(obj, key);

const clamp = (val: number, min: number, max: number): number =>
  Math.min(Math.max(val, min), max);

const omit = <O extends object, K extends keyof O>(
  obj: O,
  keysToOmit: K[]
): Omit<O, K> => {
  const omitSet = new Set(keysToOmit as string[]);
  return fromEntries(
    filterArray(entries(obj), ([key]) => !omitSet.has(key))
  ) as unknown as Omit<O, K>;
};

const pick = <O extends object, K extends keyof O>(
  obj: O,
  keysToPick: K[]
): Pick<O, K> =>
  fromEntries(
    mapArray(keysToPick, key => [key, obj[key]] as [K, O[K]])
  ) as unknown as Pick<O, K>;

const groupBy = <T>(
  arr: T[],
  keyFn: (item: T) => string
): Record<string, T[]> =>
  reduceArray(
    arr,
    (acc, item) => {
      const key = keyFn(item);
      return { ...acc, [key]: [...(acc[key] ?? []), item] };
    },
    {} as Record<string, T[]>
  );

const uniqueBy = <T>(arr: T[], keyFn: (item: T) => unknown): T[] => {
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

const memoize = <A extends unknown[], R>(
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

const compose = <A, B, C>(
  fn2: (b: B) => C,
  fn1: (a: A) => B
): ((a: A) => C) => a => fn2(fn1(a));

const tap = <T>(fn: (val: T) => void) => (val: T): T => {
  fn(val);
  return val;
};

const debounce = <A extends unknown[], R>(
  fn: (...args: A) => R,
  ms: number
): ((...args: A) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: A) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
};

const retry = async <T>(
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

const mapObject = <K extends string, V, R>(
  obj: Record<K, V>,
  fn: (value: V, key: K) => R
): Record<K, R> =>
  fromEntries(
    mapArray(entries(obj), ([key, value]) => [key, fn(value, key as K)] as [K, R])
  ) as unknown as Record<K, R>;

const filterObject = <K extends string, V>(
  obj: Record<K, V>,
  fn: (value: V, key: K) => boolean
): Partial<Record<K, V>> =>
  fromEntries(
    filterArray(entries(obj), ([key, value]) => fn(value, key as K))
  ) as unknown as Partial<Record<K, V>>;

const flatten = <T>(arr: T[][]): T[] => arr.flat();

const zip = <T, U>(a: T[], b: U[]): [T, U][] => {
  const minLen = Math.min(a.length, b.length);
  return pipe(
    Array.from({ length: minLen }, (_, i) => i),
    filterArray(i => a[i] !== undefined && b[i] !== undefined),
    mapArray(i => [a[i], b[i]] as [T, U])
  );
};

const partition = <T>(arr: T[], fn: Predicate<T>): [T[], T[]] =>
  reduceArray(
    arr,
    ([pass, fail], item) => fn(item)
      ? [[...pass, item], fail]
      : [pass, [...fail, item]],
    [[] as T[], [] as T[]] as [T[], T[]]
  );

export { isRecord, isPromise, hasOwn, clamp, omit, pick, groupBy, uniqueBy, memoize, compose, tap, debounce, retry, mapObject, filterObject, flatten, zip, partition };

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
