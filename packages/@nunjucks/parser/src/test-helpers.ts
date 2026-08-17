// WHY: test-only helper — never exported via the package barrel; co-located *.test.ts
// files use it to unwrap parse Results, turning errors into loud test failures.
import { isErr, type Result } from '@nunjucks/lib';

/** Unwraps a parse `Result` in tests, throwing the error so failures are loud. */
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (isErr(result)) {
    throw result.error;
  }
  return result.value;
};
