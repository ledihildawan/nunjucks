import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { makeComponent } from '@nunjucks/runtime';
import { makeFilterError, isArray, requireArrayError, assertItemsHaveAttr } from '../factory/index.ts';
import { getAttrGetter } from '../attributes.ts';

export const groupby = makeComponent(
  ['arr', 'attr'],
  [],
  (arr: unknown, attr: string): Record<string, unknown[]> => {
    if (!isArray(arr)) { throw requireArrayError(arr, ERROR_DEFINITIONS.GROUPBY_FILTER); }
    assertItemsHaveAttr(arr, attr, ERROR_DEFINITIONS.GROUPBY_FILTER_ATTR);
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
