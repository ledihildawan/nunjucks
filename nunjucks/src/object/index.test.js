import { expect, describe, test } from 'bun:test';
import { createObj, createEmitter, extendObj, extendEmitter } from './index.js';

describe('createObj', () => {
  test('creates object with typename', () => {
    const obj = createObj('Test');
    expect(obj.typename).toBe('Test');
  });

  test('stores init method for manual invocation', () => {
    let inited = false;
    const obj = createObj('Test', {
      init() { inited = true; }
    });
    expect(typeof obj.init).toBe('function');
    obj.init();
    expect(inited).toBe(true);
  });

  test('adds methods from props', () => {
    const obj = createObj('Greeter', {
      hello() { return 'hi'; }
    });
    expect(obj.hello()).toBe('hi');
  });
});

describe('createEmitter', () => {
  test('creates object with typename', () => {
    const emitter = createEmitter('TestEmitter');
    expect(emitter.typename).toBe('TestEmitter');
  });

  test('is an EventEmitter', () => {
    const emitter = createEmitter('Test');
    expect(typeof emitter.on).toBe('function');
    expect(typeof emitter.emit).toBe('function');
  });

  test('emits events', () => {
    const emitter = createEmitter('Test');
    let emitted = false;
    emitter.on('test', () => { emitted = true; });
    emitter.emit('test');
    expect(emitted).toBe(true);
  });
});

describe('extendObj', () => {
  test('extends existing object with typename', () => {
    const base = createObj('Base');
    const extended = extendObj(base, 'Extended');
    expect(extended.typename).toBe('Extended');
  });

  test('inherits methods from base', () => {
    const base = createObj('Base', {
      hello() { return 'base'; }
    });
    const extended = extendObj(base, 'Extended');
    expect(extended.hello()).toBe('base');
  });

  test('can override methods', () => {
    const base = createObj('Base', {
      greet() { return 'base'; }
    });
    const extended = extendObj(base, 'Extended', {
      greet() { return 'extended'; }
    });
    expect(extended.greet()).toBe('extended');
  });
});
