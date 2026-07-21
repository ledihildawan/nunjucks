const hasOwnProp = (obj: Record<string, unknown>, k: string): boolean => Object.hasOwn(obj, k);

export function _prepareAttributeParts(attr: string | number | null | undefined): string[] {
  if (!attr) {
    return [];
  }
  if (typeof attr === 'string') {
    return attr.split('.');
  }
  return [attr];
}

export function getAttrGetter(attribute: string | number): (item: Record<string, unknown>) => unknown {
  const parts = _prepareAttributeParts(attribute);
  return function attrGetter(item: Record<string, unknown>): unknown {
    let _item: Record<string, unknown> | unknown = item;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (_item !== null && _item !== undefined && typeof _item === 'object' && hasOwnProp(_item as Record<string, unknown>, part)) {
        _item = (_item as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return _item;
  };
}
