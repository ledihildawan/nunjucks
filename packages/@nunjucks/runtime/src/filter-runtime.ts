import { awaitValue } from './await-value.ts';
import { isThenable } from '@nunjucks/lib';
import { ok, err, type Result } from '@nunjucks/lib';

interface FilterEnv {
  getFilter: (name: string, lineno: number, colno: number) => (...args: unknown[]) => unknown;
}

const isFilterEnv = (env: unknown): env is FilterEnv =>
  env !== null && typeof env === 'object' && 'getFilter' in env && typeof env.getFilter === 'function';

interface RunFilterOptions {
  env: unknown;
  name: string;
  lineno: number;
  colno: number;
  context: unknown;
  args: unknown[];
}

const isOkResult = (value: unknown): value is { ok: true; value: unknown } =>
  typeof value === 'object' && value !== null && (value as { ok: unknown }).ok === true;

const isErrResult = (value: unknown): value is { ok: false; error: unknown } =>
  typeof value === 'object' && value !== null && (value as { ok: unknown }).ok === false;

const runFilter = async (options: RunFilterOptions): Promise<Result<unknown, unknown>> => {
  const { env, name, lineno, colno, context, args } = options;
  if (!isFilterEnv(env)) {
    return err(new TypeError('runFilter requires an environment exposing getFilter(name, lineno, colno)'));
  }
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

export { runFilter };
export type { RunFilterOptions };
