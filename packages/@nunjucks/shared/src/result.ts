interface Ok<T, _E> {
  ok: true;
  value: T;
}

interface Err<_T, E> {
  ok: false;
  error: E;
}

type Result<T, E> = Ok<T, E> | Err<T, E>;

const ok = <T>(value: T): Ok<T, never> => ({ ok: true, value });

const err = <E>(error: E): Err<never, E> => ({ ok: false, error });

const isOk = <T, E>(result: Result<T, E>): result is Ok<T, E> => result.ok;

const isErr = <T, E>(result: Result<T, E>): result is Err<T, E> => !result.ok;

const map = <T, U, E>(result: Result<T, E>, transform: (value: T) => U): Result<U, E> =>
  result.ok ? ok(transform(result.value)) : result;

const flatMap = <T, U, E>(result: Result<T, E>, chain: (value: T) => Result<U, E>): Result<U, E> =>
  result.ok ? chain(result.value) : result;

const mapErr = <T, E, F>(result: Result<T, E>, transform: (error: E) => F): Result<T, F> =>
  result.ok ? result : err(transform(result.error));

const getOrElse = <T, E>(result: Result<T, E>, fallback: T): T =>
  result.ok ? result.value : fallback;

const fromThrowable = <T>(thunk: () => T): Result<T, unknown> => {
  try {
    return ok(thunk());
  } catch (error) {
    return err(error);
  }
};

export {
  ok,
  err,
  isOk,
  isErr,
  map,
  flatMap,
  mapErr,
  getOrElse,
  fromThrowable,
};
export type { Ok, Err, Result };

