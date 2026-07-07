const ObjProto = Object.prototype;

export function hasOwnProp(obj, k) {
  return ObjProto.hasOwnProperty.call(obj, k);
}

export function isFunction(obj) {
  return ObjProto.toString.call(obj) === '[object Function]';
}

export function isArray(obj) {
  return ObjProto.toString.call(obj) === '[object Array]';
}

export function isString(obj) {
  return ObjProto.toString.call(obj) === '[object String]';
}

export function isObject(obj) {
  return ObjProto.toString.call(obj) === '[object Object]';
}
