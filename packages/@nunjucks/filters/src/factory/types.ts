import { isSafeString } from '@nunjucks/shared/safe-string';
import type { SafeString } from '@nunjucks/shared/safe-string';
import type { Phase } from '@nunjucks/shared';

export { isSafeString };
export type { SafeString };

export type FilterContext = {
  logContext?: { templateName?: string; phase?: Phase; renderContext?: unknown };
  env?: { getTest: (name: string) => (this: unknown, ...args: unknown[]) => boolean } | undefined;
} | undefined;

export type StringFn = (s: string) => string;

export const isArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);
