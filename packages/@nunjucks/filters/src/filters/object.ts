import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { makeComponent } from '@nunjucks/runtime';
import { makeFilterError, isArray, requireArrayError, validateItemsHaveAttr } from '../factory/index.ts';
import { getAttrGetter } from './attributes.ts';

export const groupby = makeComponent(
  ['arr', 'attr'],
  [],
  (items: unknown, attr: string): Record<string, unknown[]> => {
    if (!isArray(items)) { throw requireArrayError(items, ERROR_DEFINITIONS.GROUPBY_FILTER); }
    const validatedResult = validateItemsHaveAttr<unknown>({ items, attr, errorDef: ERROR_DEFINITIONS.GROUPBY_FILTER_ATTR });
    if (!validatedResult.ok) { throw validatedResult.error; }
    const typedItems = validatedResult.value;
    const getAttr = getAttrGetter(attr);
    return Object.groupBy(typedItems, (item) => {
      const key = getAttr(item);
      if (key === undefined) {
        throw makeFilterError({ errorDef: ERROR_DEFINITIONS.GROUPBY_FILTER_ATTR, params: { attr }, subject: attr, fallbackMessage: `Attribute "${attr}" not found in item` });
      }
      return String(key);
    }) as Record<string, unknown[]>;
  }
);
