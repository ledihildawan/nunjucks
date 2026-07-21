import EventEmitter from 'events';
import { keys, isFunction } from 'remeda';

const OBJ = Symbol('obj');
const EMITTER = Symbol('emitter');

function parentWrap(parent: unknown, prop: unknown): unknown {
  if (!isFunction(parent) || !isFunction(prop)) {
    return prop;
  }
  return function wrap(this: { parent: unknown }, ...args: unknown[]): unknown {
    const tmp = this.parent;
    this.parent = parent;
    const res = (prop as (...a: unknown[]) => unknown).apply(this, args);
    this.parent = tmp;
    return res;
  };
}

export function createObj(props: Record<string, unknown> = {}): Record<string, unknown> {
  const clonedProps = { ...props };
  keys(clonedProps).forEach(k => {
    clonedProps[k] = parentWrap(clonedProps[k], clonedProps[k]);
  });

  const obj: Record<string, unknown> & { [OBJ]: boolean } = {
    [OBJ]: true,
    ...clonedProps,
  };

  obj.init = clonedProps.init || function () {};

  return obj;
}

export function createEmitter(props: Record<string, unknown> = {}): EventEmitter & Record<string, unknown> {
  const emitter = new EventEmitter();
  const clonedProps = { ...props };

  keys(clonedProps).forEach(k => {
    clonedProps[k] = parentWrap((emitter as unknown as Record<string, unknown>)[k], clonedProps[k]);
  });

  const emitterObj = Object.assign(emitter, {
    [EMITTER]: true,
    init: clonedProps.init || function () {},
    ...clonedProps,
  });

  return emitterObj as EventEmitter & Record<string, unknown>;
}

export function extendObj(
  baseObj: unknown,
  nameOrProps: string | Record<string, unknown> = 'anonymous',
  props: Record<string, unknown> = {}
): unknown {
  if (typeof nameOrProps === 'object' && nameOrProps !== null) {
    props = nameOrProps as Record<string, unknown>;
    nameOrProps = (props.name as string) || 'anonymous';
  }

  const isBaseFunction = isFunction(baseObj);
  const baseFields = isBaseFunction ? ((baseObj as { fields?: string[] }).fields || []) : [];
  const newFields = (props.fields as string[]) || [];
  const allFields = [...baseFields, ...newFields];

  const customInit = props.init as ((...args: unknown[]) => void) | undefined;
  const baseInit = isBaseFunction ? (baseObj as { init?: (...a: unknown[]) => void }).init : null;
  const instanceSymbol = props.symbol as symbol | undefined;

  const factoryFn = function (this: unknown, ...args: unknown[]): unknown {
    if (this instanceof factoryFn) {
      (factoryFn.init as (...a: unknown[]) => void).apply(this, args);
      return this;
    }
    const obj = Object.create(factoryFn.prototype);

    (factoryFn.init as (...a: unknown[]) => void).call(obj, ...args);
    if (instanceSymbol) (obj as Record<symbol, unknown>)[instanceSymbol] = true;
    return obj;
  } as unknown as {
    (this: unknown, ...args: unknown[]): unknown;
    init: (...args: unknown[]) => void;
    findAll: unknown;
    iterFields: unknown;
    typename: string;
    fields: string[];
    prototype: unknown;
    [OBJ]: boolean;
    [key: string]: unknown;
  };

  factoryFn.findAll = isBaseFunction ? (baseObj as { findAll: unknown }).findAll : null;
  factoryFn.iterFields = isBaseFunction ? (baseObj as { iterFields: unknown }).iterFields : null;
  factoryFn.typename = nameOrProps as string;

  if (!isBaseFunction) {
    for (const key of keys(baseObj as Record<string, unknown>)) {
      if (key !== 'init' && key !== 'name' && typeof (baseObj as Record<string, unknown>)[key] !== 'symbol') {
        factoryFn[key] = (baseObj as Record<string, unknown>)[key];
      }
    }
  }

  for (const key of keys(props)) {
    if (key !== 'fields' && key !== 'init' && key !== 'name') {
      factoryFn[key] = props[key];
    }
  }

  factoryFn.init = customInit || function (this: { lineno: number; colno: number }, lineno: number, colno: number, ...args: unknown[]): void {
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
      (this as Record<string, unknown>)[field] = val;
    });
  };

  const baseProto = isBaseFunction ? (baseObj as { prototype: unknown }).prototype : Object.prototype;
  factoryFn.prototype = Object.create(baseProto);
  (factoryFn.prototype as Record<string, unknown>).findAll = isBaseFunction ? (baseObj as { findAll: unknown }).findAll : null;
  (factoryFn.prototype as Record<string, unknown>).iterFields = isBaseFunction ? (baseObj as { iterFields: unknown }).iterFields : null;
  (factoryFn.prototype as Record<string, unknown>).constructor = factoryFn;
  Object.defineProperty(factoryFn.prototype, 'fields', { get: () => allFields, configurable: true });
  Object.defineProperty(factoryFn, 'fields', { get: () => allFields, configurable: true });

  factoryFn[OBJ] = true;

  return factoryFn;
}

export function extendEmitter(
  baseEmitter: Record<string, unknown>,
  nameOrProps: string | Record<string, unknown> = 'anonymous',
  props: Record<string, unknown> = {}
): EventEmitter & Record<string, unknown> {
  if (typeof nameOrProps === 'object') {
    props = nameOrProps as Record<string, unknown>;
    nameOrProps = 'anonymous';
  }
  return createEmitter({ ...baseEmitter, ...props });
}

export const isObj = (obj: unknown): boolean => (obj as Record<symbol, unknown> | null)?.[OBJ] === true;
export const isEmitter = (obj: unknown): boolean => (obj as Record<symbol, unknown> | null)?.[EMITTER] === true;
