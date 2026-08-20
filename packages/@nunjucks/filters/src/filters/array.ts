import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import {
  createSortComparator,
  err,
  getAttrGetter,
  isSafeString,
  ok,
  type Result,
} from '@nunjucks/lib';
import { isPlainObject, keys, range, sum as sumValues } from 'remeda';
import {
  createFilter,
  createFilterError,
  isArray,
  requireArrayError,
  validateItemsHaveAttr,
} from '../factory/index.ts';

/** Returns the first element; non-arrays fail the `first`/`last` contract. */
export const first = (values: unknown): Result<unknown, TemplateError> => {
  if (!isArray(values)) {
    return err(requireArrayError(values, ERROR_DEFINITIONS.FIRST_LAST_FILTER));
  }
  return ok(values[0]);
};

/** Returns the last element; non-arrays fail the `first`/`last` contract. */
export const last = (values: unknown): Result<unknown, TemplateError> => {
  if (!isArray(values)) {
    return err(requireArrayError(values, ERROR_DEFINITIONS.FIRST_LAST_FILTER));
  }
  return ok(values.at(-1));
};

const isMapOrSet = (value: unknown): boolean =>
  typeof Map === 'function' && (value instanceof Map || value instanceof Set);

const getCollectionSize = (value: unknown): number =>
  (value as Map<unknown, unknown> | Set<unknown>).size;

const getObjectLength = (value: unknown): number => keys(value as Record<string, unknown>).length;

// WHY: nunjucks parity — values without a numeric `length` (numbers, booleans) report 0
// instead of leaking `undefined` through a `number`-typed result.
const getValueLength = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  const length = (value as { length?: unknown }).length;
  return typeof length === 'number' ? length : 0;
};

const getLengthFromValue = (value: unknown): number => {
  if (isMapOrSet(value)) {
    return getCollectionSize(value);
  }
  if (isPlainObject(value) && !isSafeString(value)) {
    return getObjectLength(value);
  }
  return getValueLength(value);
};

/**
 * Measures a value: `Map`/`Set` by size, plain objects by key count, anything
 * else by numeric `length`; nullish/false coerce to the empty string and
 * length-less values (numbers, booleans) report 0.
 */
export const lengthFilter = (input: unknown): Result<number, TemplateError> => {
  const value = input === null || input === undefined || input === false ? '' : input;
  return ok(getLengthFromValue(value));
};

/** Reverses arrays and strings (by code points); other types fail the contract. */
export const reverse = (value: unknown): Result<unknown[] | string, TemplateError> => {
  if (typeof value === 'string') {
    return ok([...value].toReversed().join(''));
  }
  if (isArray(value)) {
    return ok([...value].toReversed());
  }
  return err(
    createFilterError({
      errorDef: ERROR_DEFINITIONS.LIST_FILTER,
      params: { type: typeof value },
      subject: typeof value,
      fallbackMessage: `Expected string or array but got ${typeof value}`,
    })
  );
};

const computeSliceParams = (
  arrLength: number,
  slices: number
): { sliceLength: number; extra: number } => {
  const sliceLength = Math.floor(arrLength / slices);
  const extra = arrLength % slices;
  return { sliceLength, extra };
};

interface SingleSliceInput {
  items: unknown[];
  index: number;
  sliceLength: number;
  extra: number;
  fillWith: unknown | undefined;
}

// WHY: the running offset of the original left-fold is fully derivable — each of the
// first `extra` slices consumes one additional element, so the offset at `index` is
// exactly min(index, extra). This keeps the slice build declarative and O(n) instead
// of thread-and-spread (O(n²) in slice count).
const buildSingleSlice = ({
  items,
  index,
  sliceLength,
  extra,
  fillWith,
}: SingleSliceInput): unknown[] => {
  const offset = Math.min(index, extra);
  const start = offset + index * sliceLength;
  const end = (index < extra ? offset + 1 : offset) + (index + 1) * sliceLength;
  const currSlice = items.slice(start, end);
  return fillWith !== undefined && index >= extra ? [...currSlice, fillWith] : currSlice;
};

// WHY: createFilter-wrapped so BOTH forms bind — positional `arr |> slice(3)` and
// kwargs `slice(3, fill='x')`. A bare positional function would receive the keywords
// envelope as the fill value.
interface SliceFilterOptions {
  values: unknown;
  slices: number;
  fill?: unknown;
}

const sliceImpl = ({
  values,
  slices,
  fill,
}: SliceFilterOptions): Result<unknown[][], TemplateError> => {
  if (!isArray(values)) {
    return err(requireArrayError(values, ERROR_DEFINITIONS.LIST_FILTER));
  }
  if (slices <= 0) {
    return err(
      createFilterError({
        errorDef: ERROR_DEFINITIONS.SLICE_ZERO,
        params: {},
        subject: '',
        fallbackMessage: 'slices must be positive',
      })
    );
  }
  const { sliceLength, extra } = computeSliceParams(values.length, slices);
  const resultSlices = range(0, slices).map((index) =>
    buildSingleSlice({ items: values, index, sliceLength, extra, fillWith: fill })
  );
  return ok(resultSlices);
};

/**
 * Splits an array into `slices` balanced chunks, padding short tails with
 * `fill`; positional `slice(3, 'x')` and kwargs `slice(3, fill='x')` both bind.
 */
export const slice = createFilter(['values', 'slices', 'fill'], sliceImpl);

interface SumWithAttributeInput {
  items: unknown[];
  attr: string;
  start: number;
}

const sumWithAttribute = ({
  items,
  attr,
  start,
}: SumWithAttributeInput): Result<number, TemplateError> => {
  const validatedResult = validateItemsHaveAttr({
    items,
    attr,
    errorDef: ERROR_DEFINITIONS.SUM_FILTER_ATTR,
  });
  if (!validatedResult.ok) {
    return err(validatedResult.error);
  }
  const typedItems = validatedResult.value;
  // WHY: attr may be a dotted path ('user.age'); getAttrGetter resolves it with the
  // same own-property walk the validation above performed.
  const getAttr = getAttrGetter(attr);
  const values = typedItems.map((item) => getAttr(item));
  if (!values.every((value): value is number => typeof value === 'number')) {
    return err(
      createFilterError({
        errorDef: ERROR_DEFINITIONS.SUM_FILTER_ATTR,
        params: { attr },
        subject: attr,
        fallbackMessage: `Attribute "${attr}" must contain numbers`,
      })
    );
  }
  return ok(start + sumValues(values));
};

const sumWithoutAttribute = (items: unknown[], start: number): Result<number, TemplateError> => {
  if (!items.every((value): value is number => typeof value === 'number')) {
    return err(
      createFilterError({
        errorDef: ERROR_DEFINITIONS.SUM_FILTER,
        params: { type: 'array' },
        subject: 'array',
        fallbackMessage: 'Array must contain numbers',
      })
    );
  }
  return ok(start + sumValues(items));
};

// WHY: createFilter-wrapped so BOTH forms bind — positional `sum(items, 'n', 10)` and
// kwargs `sum(attr='n')`. A bare positional function would receive the keywords
// envelope as `attr` and fail with a cryptic attribute error.
interface SumFilterOptions {
  values: unknown;
  attr?: string;
  start?: number;
}

const sumImpl = ({ values, attr, start }: SumFilterOptions): Result<number, TemplateError> => {
  if (!isArray(values)) {
    return err(requireArrayError(values, ERROR_DEFINITIONS.SUM_FILTER));
  }
  if (attr) {
    return sumWithAttribute({ items: values, attr, start: start ?? 0 });
  }
  return sumWithoutAttribute(values, start ?? 0);
};

/**
 * Sums array numbers — or the items' `attr` values when given — starting from
 * `start`; positional `sum(items, 'n', 10)` and kwargs `sum(attr='n')` bind.
 */
export const sum = createFilter(['values', 'attr', 'start'], sumImpl);

interface SortOptions {
  sortAttr?: string | undefined;
  sortReverse?: boolean | undefined;
  caseSens?: boolean | undefined;
}

const sortArray = (values: unknown[], options: SortOptions): Result<unknown[], TemplateError> => {
  const { sortAttr, sortReverse, caseSens } = options;
  if (sortAttr) {
    const validatedResult = validateItemsHaveAttr({
      items: values,
      attr: sortAttr,
      errorDef: ERROR_DEFINITIONS.SORT_FILTER_ATTR,
    });
    if (!validatedResult.ok) {
      return err(validatedResult.error);
    }
  }
  const comparator = createSortComparator({ sortAttr, sortReverse, caseSens });
  return ok(values.toSorted(comparator));
};

interface SortOptionsInput {
  values: unknown[];
  reversed?: boolean | string;
  caseSens?: boolean | string;
  attr?: string;
}

const isTruthyKwarg = (value: boolean | string | undefined): boolean =>
  value === true || value === 'true';

const sortImpl = ({
  values,
  reversed,
  caseSens,
  attr,
}: SortOptionsInput): Result<unknown[], TemplateError> => {
  if (!isArray(values)) {
    return err(requireArrayError(values, ERROR_DEFINITIONS.SORT_FILTER));
  }
  const reversedIsString = typeof reversed === 'string';
  const sortAttr = reversedIsString ? reversed : attr;
  const sortReverse = reversedIsString ? isTruthyKwarg(caseSens) : isTruthyKwarg(reversed);
  return sortArray(values, { sortAttr, sortReverse, caseSens: isTruthyKwarg(caseSens) });
};

/**
 * Sorts an array, case-insensitively by default. A string in the positional
 * `reversed` slot is really the attribute (nunjucks `sort(attr, ...)` form),
 * and `caseSens` then carries the reverse flag.
 */
export const sort = createFilter(['values', 'reversed', 'caseSens', 'attr'], sortImpl);
