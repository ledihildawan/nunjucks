import { isSafeString, type SafeString } from '@nunjucks/lib';
import type { Phase } from '@nunjucks/shared';

export type { SafeString };
export { isSafeString };

/**
 * Render-time context handed to filter implementations; carries an optional
 * log context (`templateName`, `phase`) and an `env` exposing `getTest`.
 */
export type FilterContext =
  | {
      logContext?: { templateName?: string; phase?: Phase; renderContext?: unknown };
      env?:
        | { getTest: (name: string) => (this: unknown, ...args: unknown[]) => boolean }
        | undefined;
    }
  | undefined;

/** A pure string-to-string transform wrapped by `createStringFilter`. */
export type StringFn = (s: string) => string;

/** Narrows a value to `unknown[]`; a thin predicate over `Array.isArray`. */
export const isArray = (value: unknown): value is unknown[] => Array.isArray(value);
