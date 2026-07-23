import { hasOwn } from '@nunjucks/shared/type-guards';

export const _prepareAttributeParts = (attr: string | number | null | undefined): (string | number)[] => {
  if (!attr) return [];
  return typeof attr === 'string' ? attr.split('.') : [attr];
};

export const getAttrGetter = (attribute: string | number): ((item: Record<string, unknown>) => unknown) => {
  const parts = _prepareAttributeParts(attribute);
  return (item: Record<string, unknown>): unknown => {
    let _item: unknown = item;
    for (const part of parts) {
      if (_item != null && typeof _item === 'object' && hasOwn(_item as Record<string, unknown>, String(part))) {
        _item = (_item as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return _item;
  };
};
