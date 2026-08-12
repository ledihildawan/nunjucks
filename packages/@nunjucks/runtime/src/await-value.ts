import { isThenable } from '@nunjucks/lib';

export const awaitValue = <T>(value: T | Promise<T>): Promise<T> | T => {
  if (isThenable(value)) {
    return (value as Promise<T>).then((v) => v);
  }
  return value;
};
