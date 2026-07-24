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
      const errorDef = ERROR_DEFINITIONS.GROUPBY_FILTER;
      if (errorDef) {
        throw filterError(undefined, errorDef, { type: typeof arr }, typeof arr);
      }
      throw new Error(`Expected array but got ${typeof arr}`);
    }
    for (const item of arr) {
      if (item && typeof item === 'object' && !(attr in (item as object))) {
        const errorDef = ERROR_DEFINITIONS.GROUPBY_FILTER_ATTR;
        if (errorDef) {
          throw filterError(undefined, errorDef, { attr }, attr);
        }
        throw new Error(`Attribute "${attr}" not found in item`);
      }
    }
    const getAttr = getAttrGetter(attr);
    return Object.groupBy(arr as object[], (item) => {
      const key = getAttr(item as Record<string, unknown>);
      if (key === undefined) {
        const errorDef = ERROR_DEFINITIONS.GROUPBY_FILTER_ATTR;
        if (errorDef) {
          throw filterError(undefined, errorDef, { attr }, attr);
        }
        throw new Error(`Attribute "${attr}" not found in item`);
      }
      return String(key);
    }) as Record<string, unknown[]>;
  }
);
