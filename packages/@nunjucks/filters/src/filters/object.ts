import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import type { Result } from '@nunjucks/lib';
import { err, getAttrGetter, ok } from '@nunjucks/lib';
import { createComponent } from '@nunjucks/runtime';
import { entries, isPlainObject } from 'remeda';
import {
  createFilter,
  createFilterError,
  isArray,
  requireArrayError,
  validateItemsHaveAttr,
} from '../factory/index.ts';

/**
 * Groups array items into a map keyed by `String(getAttr(item))`; the
 * attribute resolves via attribute-path semantics (dot paths supported) and
 * every item must own it.
 */
export const groupby = createComponent({
  argNames: ['arr', 'attr'],
  kwargNames: [],
  func: (items: unknown, attr: string): Result<Record<string, unknown[]>, TemplateError> => {
    if (!isArray(items)) {
      return err(requireArrayError(items, ERROR_DEFINITIONS.GROUPBY_FILTER));
    }
    const validatedResult = validateItemsHaveAttr({
      items,
      attr,
      errorDef: ERROR_DEFINITIONS.GROUPBY_FILTER_ATTR,
    });
    if (!validatedResult.ok) {
      return err(validatedResult.error);
    }
    const typedItems = validatedResult.value;
    const getAttr = getAttrGetter(attr);
    const grouped = Object.groupBy(typedItems, (item) => String(getAttr(item)));
    return ok(grouped as Record<string, unknown[]>);
  },
});

interface DictsortOptions {
  val: unknown;
  caseSensitive?: boolean | string;
  by?: string;
}

const isTruthyKwarg = (value: boolean | string | undefined): boolean =>
  value === true || value === 'true';

const dictsortImpl = ({
  val,
  caseSensitive,
  by,
}: DictsortOptions): Result<[string, unknown][], TemplateError> => {
  if (!isPlainObject(val)) {
    return err(
      createFilterError({
        errorDef: ERROR_DEFINITIONS.GROUPBY_FILTER,
        params: { type: typeof val },
        subject: typeof val,
        fallbackMessage: `dictsort: expected object but got ${typeof val}`,
      })
    );
  }
  if (by !== undefined && by !== 'key' && by !== 'value') {
    return err(
      createFilterError({
        errorDef: undefined,
        params: { by: String(by) },
        subject: String(by),
        fallbackMessage: 'dictsort: you can only sort by either key or value',
      })
    );
  }
  const sortIndex = by === 'value' ? 1 : 0;
  const caseSens = isTruthyKwarg(caseSensitive);
  // WHY: own keys only — upstream's for..in deliberately walks the prototype chain,
  // but this port enforces own-property discipline everywhere (frame lookups, block
  // registries, attribute getters), so inherited members stay invisible here too.
  const pairs = entries(val) as [string, unknown][];
  // WHY: relational comparison needs primitives — object values fall back to their
  // string form, where upstream's raw `>` would yield NaN comparisons and an
  // arbitrary-but-stable order anyway.
  const toComparable = (value: unknown): string | number | bigint | boolean => {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'bigint' ||
      typeof value === 'boolean'
    ) {
      return value;
    }
    return String(value);
  };
  return ok(
    pairs.toSorted((a, b) => {
      const x = toComparable(a[sortIndex]);
      const y = toComparable(b[sortIndex]);
      const foldX = !caseSens && typeof x === 'string' ? x.toUpperCase() : x;
      const foldY = !caseSens && typeof y === 'string' ? y.toUpperCase() : y;
      return foldX > foldY ? 1 : foldX === foldY ? 0 : -1;
    })
  );
};

/**
 * Sorts an object's own entries as `[key, value]` pairs — by key (default) or
 * `by='value'`, case-insensitively unless `caseSensitive` is set.
 */
export const dictsort = createFilter(['val', 'caseSensitive', 'by'], dictsortImpl);

interface DumpOptions {
  obj: unknown;
  spaces?: number | string;
}

const dumpImpl = ({ obj, spaces }: DumpOptions): Result<string, TemplateError> => {
  try {
    // WHY: ?? 'undefined' — JSON.stringify returns undefined for bare
    // functions/undefined (no exception), and the string form is the filter's
    // whole output; tojson already established this substitution.
    return ok(JSON.stringify(obj, null, spaces) ?? 'undefined');
  } catch {
    return err(
      createFilterError({
        errorDef: undefined,
        params: { type: typeof obj },
        subject: typeof obj,
        fallbackMessage: 'dump: value is not JSON-serializable (cyclic reference)',
      })
    );
  }
};

/** Serializes any JSON-safe value with `JSON.stringify(obj, null, spaces)`. */
export const dump = createFilter(['obj', 'spaces'], dumpImpl);
