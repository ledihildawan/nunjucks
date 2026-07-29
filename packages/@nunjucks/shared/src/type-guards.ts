// Imported for use inside this module.
import { isNonNullish, isArray, filter as filterArray, map as mapArray, reduce as reduceArray, entries, fromEntries } from 'remeda';

// Re-exported straight through, so consumers get remeda's own bindings rather
// than a local alias that hides where they came from.

const isRecord = (val: unknown): val is Record<string, unknown> =>
  isNonNullish(val) && typeof val === 'object' && !isArray(val);

const hasOwn = <O extends object, K extends PropertyKey>(
  obj: O,
  key: K
): obj is O & Record<K, unknown> => Object.hasOwn(obj, key);

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

const filterObject = <K extends string, V>(
  obj: Record<K, V>,
  fn: (value: V, key: K) => boolean
): Partial<Record<K, V>> =>
  fromEntries(
    filterArray(entries(obj), ([key, value]) => fn(value, key as K))
  ) as unknown as Partial<Record<K, V>>;

export { isRecord, hasOwn, omit, pick, groupBy, filterObject };

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
