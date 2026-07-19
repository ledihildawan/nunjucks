import { ERROR_DEFINITIONS } from '@nunjucks/log';

export class TimeoutError extends Error {
  constructor(message = 'Template execution timed out') {
    super(message);
    this.name = 'TimeoutError';
    this.code = ERROR_DEFINITIONS.TIMEOUT.name;
  }
}

export const withTimeout = (promise, ms, onTimeout) => {
  if (!ms || ms <= 0) {
    return promise;
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (onTimeout) {
        onTimeout();
      }
      reject(new TimeoutError(`Template execution timed out after ${ms}ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

export const withTimeoutSync = (fn, ms, onTimeout) => {
  if (!ms || ms <= 0) {
    return fn();
  }

  let finished = false;
  let result;

  const timer = setTimeout(() => {
    if (!finished && onTimeout) {
      onTimeout();
    }
    throw new TimeoutError(`Template rendering timed out after ${ms}ms`);
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
