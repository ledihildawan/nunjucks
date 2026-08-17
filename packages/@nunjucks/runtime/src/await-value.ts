import { isThenable } from '@nunjucks/lib';

/**
 * Awaits a value without wrapping: returns thenables as-is (identity
 * passthrough) and passes every other value through synchronously, keeping
 * non-promise renders free of a needless microtask hop.
 */
export const awaitValue = <T>(value: T | Promise<T>): Promise<T> | T => {
  if (isThenable(value)) {
    // WHY: identity passthrough — returning the same thenable avoids a redundant `.then`
    // wrapper allocation; the isThenable guard exists to keep non-thenable values synchronous.
    // The cast restores T: isThenable narrows to Promise<unknown>, which is not assignable
    // to the caller's specific Promise<T>.
    return value as Promise<T>;
  }
  return value;
};
