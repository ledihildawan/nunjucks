import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import type { Result } from '@nunjucks/lib';
import { err, ok } from '@nunjucks/lib';
import { getAttrGetter } from '@nunjucks/lib/attribute-getter';
import { createComponent } from '@nunjucks/runtime';
import { isArray, requireArrayError, validateItemsHaveAttr } from '../factory/index.ts';

export const groupby = createComponent({
  argNames: ['arr', 'attr'],
  kwargNames: [],
  func: (items: unknown, attr: string): Result<Record<string, unknown[]>, TemplateError> => {
    if (!isArray(items)) {
      return err(requireArrayError(items, ERROR_DEFINITIONS.GROUPBY_FILTER));
    }
    const validatedResult = validateItemsHaveAttr<unknown>({
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
