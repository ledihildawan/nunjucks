import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { makeMacro } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import { makeFilterError, isArray } from '../factory/index.ts';
import { getAttrGetter } from '../attributes.ts';

export { filterError } from '../factory/index.ts';
export type { FilterContext } from '../factory/index.ts';

export const groupby = makeMacro(
  ['arr', 'attr'],
  [],
  (arr: unknown, attr: string): Record<string, unknown[]> => {
    if (!isArray(arr)) {
      throw makeFilterError(ERROR_DEFINITIONS.GROUPBY_FILTER, { type: typeof arr }, typeof arr, `Expected array but got ${typeof arr}`);
    }
    forEach(arr as object[], (item) => {
      if (item && typeof item === 'object' && !(attr in (item as object))) {
        throw makeFilterError(ERROR_DEFINITIONS.GROUPBY_FILTER_ATTR, { attr }, attr, `Attribute "${attr}" not found in item`);
      }
    });
    const getAttr = getAttrGetter(attr);
    return Object.groupBy(arr as object[], (item) => {
      const key = getAttr(item as Record<string, unknown>);
      if (key === undefined) {
        throw makeFilterError(ERROR_DEFINITIONS.GROUPBY_FILTER_ATTR, { attr }, attr, `Attribute "${attr}" not found in item`);
      }
      return String(key);
    }) as Record<string, unknown[]>;
  }
);
