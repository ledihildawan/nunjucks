import { reduce } from 'remeda';
import { hasOwn } from '@nunjucks/shared';

export const _prepareAttributeParts = (attr: string | number | null | undefined): (string | number)[] => {
  if (attr == null) { return []; }
  if (typeof attr === 'string') {
    return attr.split('.');
  }
  return [attr];
};

export const getAttrGetter = <T extends Record<string, unknown>>(
  attribute: string | number,
): ((item: T) => unknown) => {
  const parts = _prepareAttributeParts(attribute);
  return (item: T): unknown =>
    reduce(
      parts,
      (_item, part) => {
        if (_item !== null && typeof _item === 'object' && hasOwn(_item as Record<string, unknown>, String(part))) {
          return (_item as Record<string, unknown>)[part];
        }
        return undefined;
      },
      item as unknown,
    );
};
