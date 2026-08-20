/**
 * The success variant of the canonical railway envelope. Carries the computed
 * payload in `value`; never holds an error field.
 */
interface Ok<T, _E = never> {
  ok: true;
  value: T;
}

/**
 * The failure variant of the canonical railway envelope. Expected failures are
 * values: the error payload rides in `error` and is never thrown across
 * boundaries by the caller of this library.
 */
interface Err<_T = never, E = unknown> {
  ok: false;
  error: E;
}

/**
 * The single explicit error envelope of the monorepo: a discriminated union
 * narrowed on the `ok` boolean tag (never a Go-style `[error, data]` tuple).
 * Failure states are whatever the producing layer declares as `E` — for
 * engine boundaries that is a catalogued `TemplateError`.
 */
type Result<T, E> = Ok<T, E> | Err<T, E>;

/** Wraps a successful payload into the `Ok` variant. */
const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

/** Wraps an expected failure into the `Err` variant (never throws it). */
const err = <E>(error: E): Err<never, E> => ({ ok: false, error });

/** Type guard narrowing a `Result` to its `Ok` success variant. */
const isOk = <T, E>(result: Result<T, E>): result is Ok<T, E> => result.ok;

/** Type guard narrowing a `Result` to its `Err` failure variant. */
const isErr = <T, E>(result: Result<T, E>): result is Err<T, E> => !result.ok;

/** Returns the success payload, or `fallback` when the result is `Err`. */
const getOrElse = <T, E>(result: Result<T, E>, fallback: T): T =>
  result.ok ? result.value : fallback;

export type { Err, Ok, Result };
export { err, getOrElse, isErr, isOk, ok };
