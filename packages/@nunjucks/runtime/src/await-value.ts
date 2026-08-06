import { isThenable } from '@nunjucks/shared';

export function awaitValue<T>(val: T | Promise<T>): Promise<T> | T {
  if (isThenable(val)) {
    return (val as Promise<T>).then((v) => v);
  }
  return val;
}
