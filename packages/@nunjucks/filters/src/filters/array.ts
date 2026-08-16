import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import { createSortComparator, err, ok, type Result } from '@nunjucks/lib';
import { isSafeString } from '@nunjucks/runtime';
import { isPlainObject, keys, pipe, range, reduce, sum as sumValues } from 'remeda';
import {
  createFilter,
  createFilterError,
  isArray,
  requireArrayError,
  validateItemsHaveAttr,
} from '../factory/index.ts';

export const first = (values: unknown): Result<unknown, TemplateError> => {
  if (!isArray(values)) {
    return err(requireArrayError(values, ERROR_DEFINITIONS.FIRST_LAST_FILTER));
  }
  return ok(values[0]);
};

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

export const lengthFilter = (input: unknown): Result<number, TemplateError> => {
  const value = input === null || input === undefined || input === false ? '' : input;
  return ok(getLengthFromValue(value));
};

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
  offset: number;
  sliceLength: number;
  extra: number;
  fillWith: unknown | undefined;
}

const buildSingleSlice = ({
  items,
  index,
  offset,
  sliceLength,
  extra,
  fillWith,
}: SingleSliceInput): { slice: unknown[]; newOffset: number } => {
  const start = offset + index * sliceLength;
  const newOffset = index < extra ? offset + 1 : offset;
  const end = newOffset + (index + 1) * sliceLength;
  const currSlice = items.slice(start, end);
  const currentSlice =
    fillWith !== undefined && index >= extra ? [...currSlice, fillWith] : currSlice;
  return { slice: currentSlice, newOffset };
};

// WHY: positional arity is the template-language contract (upstream `slice(n, fill)`
// syntax) — folding the params into a kwargs object would change template syntax, not
// just internal code shape.
export const slice = (
  values: unknown,
  slices: number,
  fillWith?: unknown
): Result<unknown[][], TemplateError> => {
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
  const { resultSlices } = pipe(
    range(0, slices),
    reduce(
      (acc, i) => {
        const { slice: currSlice, newOffset } = buildSingleSlice({
          items: values,
          index: i,
          offset: acc.offset,
          sliceLength,
          extra,
          fillWith,
        });
        return { resultSlices: [...acc.resultSlices, currSlice], offset: newOffset };
      },
      { resultSlices: [] as unknown[][], offset: 0 }
    )
  );
  return ok(resultSlices);
};

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
  const values = typedItems.map((item) => item[attr]);
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

// WHY: positional arity is the template-language contract (upstream `sum(attr, start)`
// syntax) — folding the params into a kwargs object would change template syntax, not
// just internal code shape.
export const sum = (values: unknown, attr?: string, start = 0): Result<number, TemplateError> => {
  if (!isArray(values)) {
    return err(requireArrayError(values, ERROR_DEFINITIONS.SUM_FILTER));
  }
  if (attr) {
    return sumWithAttribute({ items: values, attr, start });
  }
  return sumWithoutAttribute(values, start);
};

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
  const array = [...values];
  const comparator = createSortComparator({ sortAttr, sortReverse, caseSens });
  return ok(array.toSorted(comparator));
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

export const sort = createFilter(['values', 'reversed', 'caseSens', 'attr'], sortImpl);
