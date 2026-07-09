import EventEmitter from 'events';
import { keys } from 'remeda';

function parentWrap(parent, prop) {
  if (typeof parent !== 'function' || typeof prop !== 'function') {
    return prop;
  }
  return function wrap() {
    const tmp = this.parent;
    this.parent = parent;
    const res = prop.apply(this, arguments);
    this.parent = tmp;
    return res;
  };
}

function extendClass(cls, name, props) {
  props = props || {};

  keys(props).forEach(k => {
    props[k] = parentWrap(cls.prototype[k], props[k]);
  });

  class subclass extends cls {
    get typename() {
      return name;
    }
  }

  Object.assign(subclass.prototype, props);
  return subclass;
}

export class Obj {
  constructor(...args) {
    this.init(...args);
  }

  init() {}

  get typename() {
    return this.constructor.name;
  }

  static extend(name, props) {
    if (typeof name === 'object') {
      props = name;
      name = 'anonymous';
    }
    return extendClass(this, name, props);
  }
}

export class EmitterObj extends EventEmitter {
  constructor(...args) {
    super();
    this.init(...args);
  }

  init() {}

  get typename() {
    return this.constructor.name;
  }

  static extend(name, props) {
    if (typeof name === 'object') {
      props = name;
      name = 'anonymous';
    }
    return extendClass(this, name, props);
  }
}
