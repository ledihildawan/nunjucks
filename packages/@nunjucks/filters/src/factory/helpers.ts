import type { ErrorDefinitionEntry, TemplateError } from '@nunjucks/error-formatter';
import { createLog } from '@nunjucks/error-formatter';
import {
  copySafeness,
  err,
  escapeHtml,
  hasOwn,
  isSafeString,
  MATCH_ANY_RE,
  markSafe,
  normalize,
  ok,
  type Result,
} from '@nunjucks/lib';
import { getLogContext } from '@nunjucks/runtime';
import { isNonNullish } from 'remeda';
import type { FilterContext, SafeString } from './types.ts';

interface FilterErrorInput {
  ctx: FilterContext;
  errorDef: ErrorDefinitionEntry;
  params: Record<string, string>;
  subject: string;
}

const filterError = ({ ctx, errorDef, params, subject }: FilterErrorInput) => {
  const logContext = getLogContext(ctx);
  return createLog('error', {
    def: errorDef,
    params,
    subject,
    context: {
      phase: logContext.phase ?? 'render',
      templateName: logContext.templateName ?? 'inline',
      lineBase: 'zero',
    },
  });
};

interface CreateFilterErrorInput {
  errorDef: ErrorDefinitionEntry | undefined;
  params: Record<string, string>;
  subject: string;
  fallbackMessage: string;
}

/**
 * Creates a `TemplateError` log entry from a catalog `errorDef`, or from the
 * fallback message when no definition was supplied.
 */
const createFilterError = ({
  errorDef,
  params,
  subject,
  fallbackMessage,
}: CreateFilterErrorInput) => {
  const resolvedDef: ErrorDefinitionEntry = errorDef ?? {
    name: 'FILTER_ERROR',
    message: fallbackMessage,
    pattern: MATCH_ANY_RE,
  };
  return filterError({ ctx: undefined, errorDef: resolvedDef, params, subject });
};

/**
 * Marks the string form of a value as safe so it bypasses autoescape;
 * `SafeString` inputs pass through unchanged.
 */
const safeString = (str: unknown): SafeString => {
  if (isSafeString(str)) {
    return str;
  }
  const stringValue = isNonNullish(str) ? String(str) : '';
  return markSafe(stringValue);
};

/**
 * HTML-escapes the string form of a value and marks the result safe, so the
 * escaped text renders verbatim instead of being double-escaped downstream.
 */
const safeHtml = (str: unknown): SafeString => {
  if (isSafeString(str)) {
    return str;
  }
  const stringValue = isNonNullish(str) ? String(str) : '';
  return markSafe(escapeHtml(stringValue));
};

// WHY: returns string | SafeString — copySafeness hands back a boxed SafeString when
// the original was safe; the old `as string` lied about that union. Every consumer
// feeds the result straight into the escape pipeline, which handles both shapes.
const preserveSafe = (original: unknown, result: string): string | SafeString =>
  copySafeness(original, result);

/** Builds the "expected array" error for filters with an array contract. */
const requireArrayError = (value: unknown, errorDef: ErrorDefinitionEntry | undefined) =>
  createFilterError({
    errorDef,
    params: { type: typeof value },
    subject: typeof value,
    fallbackMessage: `Expected array but got ${typeof value}`,
  });

/** Builds the "expected number" error for filters with a numeric contract. */
const requireNumberError = (value: unknown, errorDef: ErrorDefinitionEntry | undefined) =>
  createFilterError({
    errorDef,
    params: { type: typeof value },
    subject: typeof value,
    fallbackMessage: `Expected number but got ${typeof value}`,
  });

interface ValidateItemsInput {
  items: unknown[];
  attr: string;
  errorDef: ErrorDefinitionEntry | undefined;
}

// WHY: getAttrGetter (and createSortComparator on top of it) resolve dotted attrs
// ('user.age') by walking OWN properties segment by segment; validation must mirror
// that walk — a plain hasOwn on the literal attr string made every dotted attr fail
// as "attribute does not exist" even though the getters read them fine. hasOwn per
// segment keeps present-but-undefined values valid, matching single-segment behavior.
const itemOwnsAttrPath = (item: unknown, attr: string): boolean => {
  let current: unknown = item;
  return attr.split('.').every((segment) => {
    if (current === null || typeof current !== 'object' || !hasOwn(current, segment)) {
      return false;
    }
    current = (current as Record<string, unknown>)[segment];
    return true;
  });
};

/**
 * Validates that every item in `items` owns `attr` — dotted paths resolve
 * segment by segment with the same own-property semantics `getAttrGetter`
 * uses — narrowing them to records or returning a filter error naming the
 * attribute.
 */
const validateItemsHaveAttr = ({
  items,
  attr,
  errorDef,
}: ValidateItemsInput): Result<Record<string, unknown>[], TemplateError> => {
  const everyHasAttr = items.every((item) => itemOwnsAttrPath(item, attr));
  if (!everyHasAttr) {
    return err(
      createFilterError({
        errorDef,
        params: { attr },
        subject: attr,
        fallbackMessage: `Attribute "${attr}" not found in item`,
      })
    );
  }
  return ok(items as Record<string, unknown>[]);
};

export { isSafeString } from './types.ts';
export {
  createFilterError,
  normalize,
  preserveSafe,
  requireArrayError,
  requireNumberError,
  safeHtml,
  safeString,
  validateItemsHaveAttr,
};
