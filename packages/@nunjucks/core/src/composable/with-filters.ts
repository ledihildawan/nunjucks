import type { RenderConfig } from '../core/render.ts';

const acceptsKwargs = (fn: (...args: unknown[]) => unknown): boolean => {
  const fnStr = fn.toString();
  return (
    /\bkwargs\s*[=,)]/.test(fnStr) ||
    /\{\s*\w+\s*[=:]/.test(fnStr) ||
    /function\s*\([^)]*kwargs/.test(fnStr) ||
    /kwargs\s*:\s*\{/.test(fnStr)
  );
};

export const withFilter = (
  name: string, 
  fn: (...args: unknown[]) => unknown
) => (config: RenderConfig): RenderConfig => ({
  ...config,
  filters: {
    ...(config.filters ?? {}),
    [name]: acceptsKwargs(fn)
      ? async (...args: unknown[]) => fn(...args)
      : async (value: unknown, ..._rest: unknown[]) => fn(value),
  },
});

export const withFilters = (filters: Record<string, (...args: unknown[]) => unknown>) => 
  (config: RenderConfig): RenderConfig => {
    const entries = Object.entries(filters).map(([name, fn]) => [
      name,
      acceptsKwargs(fn)
        ? (async (...args: unknown[]) => fn(...args))
        : (async (value: unknown, ..._rest: unknown[]) => fn(value)),
    ]);
    return {
      ...config,
      filters: { ...(config.filters ?? {}), ...Object.fromEntries(entries) },
    };
  };
