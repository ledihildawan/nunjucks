export type FilterContext = { logContext?: { templateName?: string; phase?: string; renderContext?: unknown } } | undefined;

export type StringFn = (s: string) => string;

export type StringWithArgsFn<A extends unknown[]> = (s: string, ...args: A) => string;

export type StrictFilter<T extends unknown[], R> = (...args: T) => R;

export interface SafeString {
  readonly toHTML: () => string;
  readonly length: number;
  readonly valueOf: () => string;
  readonly toString: () => string;
}

export const isSafeString = (val: unknown): val is SafeString =>
  val !== null && typeof val === 'object' && 'toHTML' in val;

export const isArray = (val: unknown): val is unknown[] =>
  Array.isArray(val);

export const isRecord = (val: unknown): val is Record<string, unknown> =>
  val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Map) && !(val instanceof Set);

export const isNumber = (val: unknown): val is number =>
  typeof val === 'number' && !Number.isNaN(val);

export const isString = (val: unknown): val is string =>
  typeof val === 'string';
