import { isNonNullish } from 'remeda';

export const Result = {
  ok: (value) => ({ isOk: true, isErr: false, value }),
  err: (error) => ({ isOk: false, isErr: true, error }),

  isOk: (result) => result.isOk === true,
  isErr: (result) => result.isErr === true,

  map: (result) => (fn) =>
    result.isOk ? Result.ok(fn(result.value)) : result,

  mapErr: (result) => (fn) =>
    result.isErr ? Result.err(fn(result.error)) : result,

  flatMap: (result) => (fn) =>
    result.isOk ? fn(result.value) : result,

  getOrElse: (result) => (defaultValue) =>
    result.isOk ? result.value : defaultValue,

  getOrThrow: (result) => {
    if (result.isErr) throw result.error;
    return result.value;
  },

  fromNullable: (value, errorMsg = 'Value is null or undefined') =>
    isNonNullish(value) ? Result.ok(value) : Result.err(new Error(errorMsg)),

  fromThrowable: (fn) => {
    try {
      return Result.ok(fn());
    } catch (e) {
      return Result.err(e);
    }
  },

  of: (value) => Result.ok(value),

  empty: () => Result.ok(null)
};

export const Maybe = {
  just: (value) => ({ isJust: true, isNothing: false, value }),
  nothing: () => ({ isJust: false, isNothing: true, value: null }),

  isJust: (maybe) => maybe.isJust === true,
  isNothing: (maybe) => maybe.isNothing === true,

  map: (maybe) => (fn) =>
    maybe.isJust ? Maybe.just(fn(maybe.value)) : maybe,

  flatMap: (maybe) => (fn) =>
    maybe.isJust ? fn(maybe.value) : maybe,

  getOrElse: (maybe) => (defaultValue) =>
    maybe.isJust ? maybe.value : defaultValue,

  fromNullable: (value) =>
    isNonNullish(value) ? Maybe.just(value) : Maybe.nothing(),

  of: (value) => Maybe.just(value),

  empty: () => Maybe.nothing()
};

export const tryCatch = (fn) => (...args) => {
  try {
    return Result.ok(fn(...args));
  } catch (e) {
    return Result.err(e);
  }
};

export const attempt = (fn) => {
  try {
    return Result.ok(fn());
  } catch (e) {
    return Result.err(e);
  }
};

export const composeAsync = (...fns) => async (initialValue) => {
  let result = initialValue;
  for (const fn of fns) {
    if (Result.isErr(result)) return result;
    result = await Promise.resolve(fn(result.value));
  }
  return result;
};

export const pipeWithResult = (initialValue, ...fns) =>
  fns.reduce((acc, fn) => {
    if (Result.isErr(acc)) return acc;
    return fn(acc.value);
  }, Result.ok(initialValue));
