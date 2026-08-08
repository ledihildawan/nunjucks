import { awaitValue } from './await-value.ts';

interface FilterEnv {
  getFilter: (name: string, lineno: number, colno: number) => (...args: unknown[]) => unknown;
}

const isFilterEnv = (env: unknown): env is FilterEnv =>
  env !== null && typeof env === 'object' && 'getFilter' in env && typeof env.getFilter === 'function';

// WHY: single chokepoint for filter invocation from generated code — resolves the filter, calls it with the render context, and awaits the result. Filter errors (bad input, undefined filter) propagate as throws to the render() Result boundary. Consolidating the two compiler emit-sites here DRYs filter invocation and opens a path to Result-returning filters.
const runFilter = async (
  env: unknown,
  name: string,
  lineno: number,
  colno: number,
  context: unknown,
  ...args: unknown[]
): Promise<unknown> => {
  if (!isFilterEnv(env)) {
    throw new TypeError('runFilter requires an environment exposing getFilter(name, lineno, colno)');
  }
  const filter = env.getFilter(name, lineno, colno);
  return awaitValue(filter.call(context, ...args));
};

export { runFilter };
