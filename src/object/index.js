import EventEmitter from 'events';
import { keys, isFunction } from 'remeda';

const OBJ = Symbol('obj');
const EMITTER = Symbol('emitter');

function parentWrap(parent, prop) {
  if (!isFunction(parent) || !isFunction(prop)) {
    return prop;
  }
  return function wrap(...args) {
    const tmp = this.parent;
    this.parent = parent;
    const res = prop.apply(this, args);
    this.parent = tmp;
    return res;
  };
}

export function createObj(props = {}) {
  const clonedProps = { ...props };
  keys(clonedProps).forEach(k => {
    clonedProps[k] = parentWrap(clonedProps[k], clonedProps[k]);
  });

  const obj = {
    [OBJ]: true,
    ...clonedProps,
  };

  obj.init = clonedProps.init || function() {};

  return obj;
}

export function createEmitter(props = {}) {
  const emitter = new EventEmitter();
  const clonedProps = { ...props };

  keys(clonedProps).forEach(k => {
    clonedProps[k] = parentWrap(emitter[k], clonedProps[k]);
  });

  const emitterObj = Object.assign(emitter, {
    [EMITTER]: true,
    init: clonedProps.init || function() {},
    ...clonedProps,
  });

  return emitterObj;
}

export function extendObj(baseObj, nameOrProps = 'anonymous', props = {}) {
  // Modern: extendObj(Base, { name: 'Name', init: fn })
  if (typeof nameOrProps === 'object' && nameOrProps !== null) {
    props = nameOrProps;
    nameOrProps = props.name || 'anonymous';
  }

  const isBaseFunction = isFunction(baseObj);
  const baseFields = isBaseFunction ? (baseObj.fields || []) : [];
  const newFields = props.fields || [];
  const allFields = [...baseFields, ...newFields];

  const customInit = props.init;
  const baseInit = isBaseFunction ? baseObj.init : null;
  const instanceSymbol = props.symbol;

  const factoryFn = function(...args) {
    if (this instanceof factoryFn) {
      factoryFn.init.apply(this, args);
      return this;
    }
    const obj = Object.create(factoryFn.prototype);

    factoryFn.init.call(obj, ...args);
    if (instanceSymbol) obj[instanceSymbol] = true;
    return obj;
  };

  factoryFn.findAll = isBaseFunction ? baseObj.findAll : null;
  factoryFn.iterFields = isBaseFunction ? baseObj.iterFields : null;
  factoryFn.typename = nameOrProps;

  if (!isBaseFunction) {
    for (const key of keys(baseObj)) {
      if (key !== 'init' && key !== 'name' && typeof baseObj[key] !== 'symbol') {
        factoryFn[key] = baseObj[key];
      }
    }
  }

  for (const key of keys(props)) {
    if (key !== 'fields' && key !== 'init' && key !== 'name') {
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
  factoryFn.prototype.constructor = factoryFn;
  Object.defineProperty(factoryFn.prototype, 'fields', { get: () => allFields, configurable: true });
  Object.defineProperty(factoryFn, 'fields', { get: () => allFields, configurable: true });

  factoryFn[OBJ] = true;

  return factoryFn;
}

export function extendEmitter(baseEmitter, nameOrProps = 'anonymous', props = {}) {
  if (typeof nameOrProps === 'object') {
    props = nameOrProps;
    nameOrProps = 'anonymous';
  }
  return createEmitter({ ...baseEmitter, ...props });
}

export const isObj = (obj) => obj?.[OBJ] === true;
export const isEmitter = (obj) => obj?.[EMITTER] === true;
