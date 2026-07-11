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

export function createObj(name = 'Obj', props = {}) {
  const clonedProps = { ...props };
  keys(clonedProps).forEach(k => {
    clonedProps[k] = parentWrap(clonedProps[k], clonedProps[k]);
  });

  const obj = {
    get typename() {
      return name;
    },
    ...clonedProps,
  };

  obj.init = clonedProps.init || function() {};

  return obj;
}

export function createEmitter(name = 'EmitterObj', props = {}) {
  const emitter = new EventEmitter();
  const clonedProps = { ...props };

  keys(clonedProps).forEach(k => {
    clonedProps[k] = parentWrap(emitter[k], clonedProps[k]);
  });

  Object.assign(emitter, {
    get typename() {
      return name;
    },
    init: clonedProps.init || function() {},
    ...clonedProps,
  });

  return emitter;
}

export function extendObj(baseObj, name, props) {
  if (typeof name === 'object') {
    props = name;
    name = 'anonymous';
  }

  props = props || {};

  const isBaseFunction = typeof baseObj === 'function';
  const baseFields = isBaseFunction ? (baseObj.fields || []) : [];
  const newFields = props.fields || [];
  const allFields = [...baseFields, ...newFields];

  const customInit = props.init;
  const baseInit = isBaseFunction ? baseObj.init : null;

  const factoryFn = function(...args) {
    if (this instanceof factoryFn) {
      factoryFn.init.apply(this, args);
      return this;
    }
    const obj = Object.create(factoryFn.prototype);

    factoryFn.init.call(obj, ...args);
    return obj;
  };

  factoryFn.typename = name;
  factoryFn.findAll = isBaseFunction ? baseObj.findAll : null;
  factoryFn.iterFields = isBaseFunction ? baseObj.iterFields : null;

  if (!isBaseFunction) {
    for (const key of keys(baseObj)) {
      if (key !== 'typename' && key !== 'init') {
        factoryFn[key] = baseObj[key];
      }
    }
  }

  for (const key of keys(props)) {
    if (key !== 'fields' && key !== 'init') {
      factoryFn[key] = props[key];
    }
  }

  factoryFn.init = customInit || function(lineno, colno, ...args) {
    if (baseInit) {
      baseInit.call(this, lineno, colno, ...args);
    }
    this.lineno = lineno;
    this.colno = colno;

    newFields.forEach((field, i) => {
      let val = args[i + baseFields.length];
      if (val === undefined) {
        val = null;
      }
      this[field] = val;
    });
  };

  const baseProto = isBaseFunction ? baseObj.prototype : Object.prototype;
  factoryFn.prototype = Object.create(baseProto);
  factoryFn.prototype.findAll = isBaseFunction ? baseObj.findAll : null;
  factoryFn.prototype.iterFields = isBaseFunction ? baseObj.iterFields : null;
  Object.defineProperty(factoryFn.prototype, 'fields', { get: () => allFields, configurable: true });
  Object.defineProperty(factoryFn.prototype, 'typename', { get: () => name, configurable: true });
  Object.defineProperty(factoryFn, 'fields', { get: () => allFields, configurable: true });
  return factoryFn;
}

export function extendEmitter(baseEmitter, name, props) {
  if (typeof name === 'object') {
    props = name;
    name = 'anonymous';
  }
  return createEmitter(name, { ...baseEmitter, ...props });
}
