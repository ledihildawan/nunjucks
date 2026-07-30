import { isSafeString, type SafeString } from '@nunjucks/runtime';

export { isSafeString };
export type { SafeString };

export type FilterContext = { logContext?: { templateName?: string; phase?: string; renderContext?: unknown } } | undefined;

export type StringFn = (s: string) => string;

export type StringWithArgsFn<A extends unknown[]> = (s: string, ...args: A) => string;

export const isArray = (val: unknown): val is unknown[] =>
  Array.isArray(val);

export const isString = (val: unknown): val is string =>
  typeof val === 'string';
