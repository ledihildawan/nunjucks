import { err, isResultLike, isThenable, ok, type Result } from '@nunjucks/lib';
import { awaitValue } from './await-value.ts';
import { isAbsentLookupResult } from './member-access.ts';

interface FilterEnv {
  getFilter: (name: string, lineno: number, colno: number) => (...args: unknown[]) => unknown;
}

const isFilterEnv = (env: unknown): env is FilterEnv =>
  env !== null &&
  typeof env === 'object' &&
  'getFilter' in env &&
  typeof env.getFilter === 'function';

interface RunFilterOptions {
  env: unknown;
  name: string;
  lineno: number;
  colno: number;
  context: unknown;
  args: unknown[];
}

const isOkResult = (value: unknown): value is { ok: true; value: unknown } =>
  isResultLike(value) && value.ok === true;

const isErrResult = (value: unknown): value is { ok: false; error: unknown } =>
  isResultLike(value) && value.ok === false;

const runFilter = async (options: RunFilterOptions): Promise<Result<unknown, unknown>> => {
  const { env, name, lineno, colno, context } = options;
  if (!isFilterEnv(env)) {
    return err(
      new TypeError('runFilter requires an environment exposing getFilter(name, lineno, colno)')
    );
  }
  // WHY: miss sentinels are the engine's internal not-found representation — filters must
  // see `undefined` (classic semantics), never the sentinel objects (which stringify as
  // "() => undefined" / "[object Object]" and corrupt filter output).
  const args = options.args.map((arg) => (isAbsentLookupResult(arg) ? undefined : arg));
  try {
    const filter = env.getFilter(name, lineno, colno);
    const value = filter.call(context, ...args);
    const resolved = awaitValue(value);
    if (isThenable(resolved)) {
      const awaited = await resolved;
      if (isErrResult(awaited)) {
        return err(awaited.error);
      }
      if (isOkResult(awaited)) {
        return awaited;
      }
      return ok(awaited);
    }
    if (isErrResult(resolved)) {
      return err(resolved.error);
    }
    if (isOkResult(resolved)) {
      return resolved;
    }
    return ok(resolved);
  } catch (error: unknown) {
    return err(error);
  }
};

export type { RunFilterOptions };
export { runFilter };
