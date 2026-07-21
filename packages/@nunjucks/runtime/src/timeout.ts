import { ERROR_DEFINITIONS } from '@nunjucks/log';

export interface TimeoutError extends Error {
  code: string;
}

export const createTimeoutError = (message = 'Template execution timed out'): TimeoutError => {
  const err = new Error(message) as TimeoutError;
  err.name = 'TimeoutError';
  err.code = ERROR_DEFINITIONS.TIMEOUT!.name;
  return err;
};

export const isTimeoutError = (e: unknown): e is TimeoutError =>
  e instanceof Error && (e as Error).name === 'TimeoutError';

export const withTimeout = <T>(promise: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> => {
  if (!ms || ms <= 0) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (onTimeout) {
        onTimeout();
      }
      reject(createTimeoutError(`Template execution timed out after ${ms}ms`));
    }, ms);

    promise
      .then((result: T) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

export const withTimeoutSync = <T>(fn: () => T, ms: number, onTimeout?: () => void): T => {
  if (!ms || ms <= 0) {
    return fn();
  }

  let finished = false;
  let result: T;

  const timer = setTimeout(() => {
    if (!finished && onTimeout) {
      onTimeout();
    }
    throw createTimeoutError(`Template rendering timed out after ${ms}ms`);
  }, ms);

  try {
    result = fn();
    finished = true;
    clearTimeout(timer);
    return result;
  } catch (err) {
    finished = true;
    clearTimeout(timer);
    throw err;
  }
};
