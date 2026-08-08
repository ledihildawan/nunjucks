import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { makeComponent } from '@nunjucks/runtime';
import { makeFilterError, isArray, requireArrayError, validateItemsHaveAttr } from '../factory/index.ts';
import { isErr } from '@nunjucks/shared';
import { getAttrGetter } from './attributes.ts';

export const groupby = makeComponent(
  ['arr', 'attr'],
  [],
  (items: unknown, attr: string): Record<string, unknown[]> => {
    if (!isArray(items)) { throw requireArrayError(items, ERROR_DEFINITIONS.GROUPBY_FILTER); }
    const validated = validateItemsHaveAttr<unknown>(items, attr, ERROR_DEFINITIONS.GROUPBY_FILTER_ATTR);
    if (isErr(validated)) { throw validated.error; }
    const typedItems = validated.value;
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
