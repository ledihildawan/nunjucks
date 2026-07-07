import { hasOwnProp } from './types.js';

export function _prepareAttributeParts(attr) {
  if (!attr) {
    return [];
  }
  if (typeof attr === 'string') {
    return attr.split('.');
  }
  return [attr];
}

export function getAttrGetter(attribute) {
  const parts = _prepareAttributeParts(attribute);
  return function attrGetter(item) {
    let _item = item;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (hasOwnProp(_item, part)) {
        _item = _item[part];
      } else {
        return undefined;
      }
    }
    return _item;
  };
}
