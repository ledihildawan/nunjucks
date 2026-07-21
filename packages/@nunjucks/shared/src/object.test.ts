import { describe, test, expect } from 'bun:test';
import { createObj, createEmitter, extendObj, isObj, isEmitter } from './object.ts';

describe('createObj', () => {
  test('creates an object with init', () => {
    const obj = createObj({
      name: 'Test',
      init: function (this: Record<string, unknown>) { this.value = 42; },
      getValue: function (this: Record<string, unknown>) { return this.value; },
    });
    obj.init();
    expect(obj.getValue()).toBe(42);
  });

  test('isObj recognizes createObj result', () => {
    const obj = createObj({});
    expect(isObj(obj)).toBe(true);
  });

  test('isObj rejects plain objects', () => {
    expect(isObj({})).toBe(false);
    expect(isObj(null)).toBe(false);
    expect(isObj(undefined)).toBe(false);
    expect(isObj('string')).toBe(false);
  });

  test('default init is a no-op', () => {
    const obj = createObj({});
    expect(typeof obj.init).toBe('function');
    expect(() => obj.init()).not.toThrow();
  });
});

describe('createEmitter', () => {
  test('creates an EventEmitter', () => {
    const emitter = createEmitter({});
    expect(isEmitter(emitter)).toBe(true);
    expect(typeof emitter.on).toBe('function');
    expect(typeof emitter.emit).toBe('function');
  });

  test('isEmitter rejects non-emitters', () => {
    expect(isEmitter({})).toBe(false);
    expect(isEmitter(null)).toBe(false);
  });

  test('supports event handling', () => {
    const emitter = createEmitter({});
    let called = false;
    emitter.on('test', () => { called = true; });
    emitter.emit('test');
    expect(called).toBe(true);
  });
});

describe('extendObj', () => {
  test('creates a factory function from a base object', () => {
    const base = { baseProp: 'inherited' };
    const Factory = extendObj(base, 'MyType', {
      fields: ['value'],
      init: function (this: Record<string, unknown>, lineno: number, colno: number, val: unknown) {
        this.lineno = lineno;
        this.colno = colno;
        this.value = val;
      },
    });
    expect(typeof Factory).toBe('function');
    expect(isObj(Factory)).toBe(true);
  });

  test('factory produces instances with fields', () => {
    const base = {};
    const Factory = extendObj(base, 'Node', {
      fields: ['value'],
      init: function (this: Record<string, unknown>, lineno: number, colno: number, val: unknown) {
        this.lineno = lineno;
        this.colno = colno;
        this.value = val;
      },
    });
    const instance = (Factory as unknown as (...args: unknown[]) => Record<string, unknown>)(0, 0, 'hello');
    expect(instance.value).toBe('hello');
    expect(instance.lineno).toBe(0);
  });
});
