export interface TimeoutError extends Error {
  code: string;
}

export const createTimeoutError = (message = 'Operation timed out'): TimeoutError => {
  const timeoutError = new Error(message) as TimeoutError;
  timeoutError.name = 'TimeoutError';
  timeoutError.code = 'TIMEOUT';
  return timeoutError;
};

export const isTimeoutError = (e: unknown): e is TimeoutError =>
  e instanceof Error && e.name === 'TimeoutError';

export const withTimeout = <T>(promise: Promise<T>, ms: number, message?: string): Promise<T> => {
  if (!ms || ms <= 0) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(createTimeoutError(message ?? `Operation timed out after ${ms}ms`));
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
