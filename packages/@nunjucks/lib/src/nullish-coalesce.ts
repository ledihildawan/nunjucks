import { isNonNullish } from './type-guards.ts';

export const nullishCoalesce = <T>(left: T | null | undefined, right: T): T => {
  if (isNonNullish(left)) {
    return left;
  }
  return right;
};
