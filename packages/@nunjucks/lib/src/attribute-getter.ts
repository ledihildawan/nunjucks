import { reduce } from 'remeda';
import { hasOwn } from './type-guards.ts';

const prepareAttributeParts = (attr: string | number | null | undefined): (string | number)[] => {
  if (attr == null) {
    return [];
  }
  if (typeof attr === 'string') {
    return attr.split('.');
  }
  return [attr];
};

const getAttrGetter = (attribute: string | number): ((item: unknown) => unknown) => {
  const parts = prepareAttributeParts(attribute);
  return (item: unknown): unknown =>
    reduce(
      parts,
      (current, part) => {
        if (
          current !== null &&
          typeof current === 'object' &&
          hasOwn(current as Record<string, unknown>, String(part))
        ) {
          return (current as Record<string, unknown>)[part];
        }
        return undefined;
      },
      item
    );
};

export { getAttrGetter };
