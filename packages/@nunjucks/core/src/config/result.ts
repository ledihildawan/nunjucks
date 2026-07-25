// Discriminated Union Result type for Railway-Oriented Programming
// This replaces throws with explicit error returns for recoverable operations

export type Result<T, E = Error> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: E };

export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// Extract result variants using Extract<T, U>
export type OkResult<T, E> = Extract<Result<T, E>, { success: true }>;
export type ErrResult<T, E> = Extract<Result<T, E>, { success: false }>;

// Constructor functions (pure)
export const ok = <T>(value: T): Result<T, never> => ({
  success: true as const,
  value
});

export const err = <E>(error: E): Result<never, E> => ({
  success: false as const,
  error
});

// Type guard - narrows to Ok variant
export const isOk = <T, E>(result: Result<T, E>): result is OkResult<T, E> =>
  result.success === true;

// Type guard - narrows to Err variant
export const isErr = <T, E>(result: Result<T, E>): result is ErrResult<T, E> =>
  result.success === false;

// Map over Ok value (functor)
export const map = <T, E, U>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> => {
  if (isOk(result)) {
    return ok(fn((result as OkResult<T, E>).value));
  }
  return err((result as ErrResult<T, E>).error);
};

// Map over Err value
export const mapErr = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => {
  if (isOk(result)) {
    return ok((result as OkResult<T, E>).value);
  }
  return err(fn((result as ErrResult<T, E>).error));
};

// Chain/flatMap (monad)
export const flatMap = <T, E, U>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => {
  if (isOk(result)) {
    return fn((result as OkResult<T, E>).value);
  }
  return err((result as ErrResult<T, E>).error);
};

// Unwrap with default
export const unwrapOr = <T>(result: Result<T, unknown>, defaultValue: T): T => {
  if (isOk(result)) {
    return (result as OkResult<T, unknown>).value;
  }
  return defaultValue;
};

// Unwrap - throws on error
export const unwrap = <T>(result: Result<T, unknown>): T => {
  if (isOk(result)) {
    return (result as OkResult<T, unknown>).value;
  }
  throw (result as ErrResult<T, unknown>).error;
};

// From throwing function
export const fromThrowable = <T>(
  fn: () => T,
  errorMapper: (e: unknown) => unknown = (e) => {
    if (e instanceof Error) {
      return e;
    }
    return new Error(String(e));
  }
): Result<T, unknown> => {
  try {
    return ok(fn());
  } catch (e) {
    return err(errorMapper(e));
  }
};

// Async version
export const fromThrowableAsync = <T>(
  fn: () => Promise<T>,
  errorMapper: (e: unknown) => unknown = (e) => {
    if (e instanceof Error) {
      return e;
    }
    return new Error(String(e));
  }
): Promise<Result<T, unknown>> =>
  fn()
    .then(ok)
    .catch((e) => err(errorMapper(e)));

// Combine results - fail fast on first error
export const combine = <T>(
  results: readonly Result<T, unknown>[]
): Result<readonly T[], unknown> => {
  const values: T[] = [];
  for (const result of results) {
    if (isErr(result)) {
      return err((result as ErrResult<T, unknown>).error);
    }
    values.push((result as OkResult<T, unknown>).value);
  }
  return ok(values);
};
