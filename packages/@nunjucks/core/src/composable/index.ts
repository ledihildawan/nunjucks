import { pipe } from 'remeda';
import type { RenderConfig } from '../core/render.ts';

export { withViews } from './with-views.ts';
export { withGlobal, withGlobals } from './with-globals.ts';
export { withFilter, withFilters } from './with-filters.ts';
export { withSandbox, type SandboxOptions } from './with-sandbox.ts';
export { withCache } from './with-cache.ts';
export { withAutoescape } from './with-autoescape.ts';

export { pipe } from 'remeda';

type ConfigFn = (c: RenderConfig) => RenderConfig;

const toConfigFn = (fn: ConfigFn | RenderConfig): ConfigFn => {
  if (typeof fn === 'function') {
    return fn;
  }
  return () => fn;
};

export const config = (...fns: (ConfigFn | RenderConfig)[]): RenderConfig => {
  const fnsToUse = fns.map(toConfigFn);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (pipe as any)({}, ...fnsToUse) as RenderConfig;
};
