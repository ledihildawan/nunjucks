interface Ok<T, _E = never> {
  ok: true;
  value: T;
}

interface Err<_T = never, E = unknown> {
  ok: false;
  error: E;
}

type Result<T, E> = Ok<T, E> | Err<T, E>;

const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

const err = <E>(error: E): Err<never, E> => ({ ok: false, error });

const isOk = <T, E>(result: Result<T, E>): result is Ok<T, E> => result.ok;

const isErr = <T, E>(result: Result<T, E>): result is Err<T, E> => !result.ok;

const getOrElse = <T, E>(result: Result<T, E>, fallback: T): T =>
  result.ok ? result.value : fallback;

export { ok, err, isOk, isErr, getOrElse };
export type { Ok, Err, Result };
