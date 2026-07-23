import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { makeMacro } from '@nunjucks/runtime';
import { filterError, isArray } from '../factory/index.ts';
import type { FilterContext } from '../factory/index.ts';
import { getAttrGetter } from '../attributes.ts';

export { filterError };
export type { FilterContext };

export const groupby = makeMacro(
  ['arr', 'attr'],
  [],
  (arr: unknown, attr: string): Record<string, unknown[]> => {
    if (!isArray(arr)) {
      throw filterError(undefined, ERROR_DEFINITIONS.GROUPBY_FILTER!, { type: typeof arr }, typeof arr);
    }
    for (const item of arr) {
      if (item && typeof item === 'object' && !(attr in (item as object))) {
        throw filterError(undefined, ERROR_DEFINITIONS.GROUPBY_FILTER_ATTR!, { attr }, attr);
      }
    }
    const getAttr = getAttrGetter(attr);
    return Object.groupBy(arr as object[], (item) => {
      const key = getAttr(item as Record<string, unknown>);
      if (key === undefined) {
        throw filterError(undefined, ERROR_DEFINITIONS.GROUPBY_FILTER_ATTR!, { attr }, attr);
      }
      return String(key);
    }) as Record<string, unknown[]>;
  }
);
