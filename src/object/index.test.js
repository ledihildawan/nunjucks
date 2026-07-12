import { expect, describe, test } from 'bun:test';
import { createObj, createEmitter, extendObj, extendEmitter, isObj, isEmitter } from './index.js';

describe('createObj', () => {
  test('creates object with symbol marker', () => {
    const obj = createObj({ name: 'Test' });
    expect(isObj(obj)).toBe(true);
  });

  test('stores init method for manual invocation', () => {
    let inited = false;
    const obj = createObj({
      name: 'Test',
      init() { inited = true; }
    });
    expect(typeof obj.init).toBe('function');
    obj.init();
    expect(inited).toBe(true);
  });

  test('adds methods from props', () => {
    const obj = createObj({
      name: 'Greeter',
      hello() { return 'hi'; }
    });
    expect(obj.hello()).toBe('hi');
  });
});

describe('createEmitter', () => {
  test('creates emitter with symbol marker', () => {
    const emitter = createEmitter({ name: 'TestEmitter' });
    expect(isEmitter(emitter)).toBe(true);
  });

  test('is an EventEmitter', () => {
    const emitter = createEmitter({ name: 'Test' });
    expect(typeof emitter.on).toBe('function');
    expect(typeof emitter.emit).toBe('function');
  });

  test('emits events', () => {
    const emitter = createEmitter({ name: 'Test' });
    let emitted = false;
    emitter.on('test', () => { emitted = true; });
    emitter.emit('test');
    expect(emitted).toBe(true);
  });
});

describe('extendObj', () => {
  test('extends existing object with symbol marker', () => {
    const base = createObj({ name: 'Base' });
    const extended = extendObj(base, { name: 'Extended' });
    expect(isObj(extended)).toBe(true);
  });

  test('inherits methods from base', () => {
    const base = createObj({
      name: 'Base',
      hello() { return 'base'; }
    });
    const extended = extendObj(base, { name: 'Extended' });
    expect(extended.hello()).toBe('base');
  });

  test('can override methods', () => {
    const base = createObj({
      name: 'Base',
      greet() { return 'base'; }
    });
    const extended = extendObj(base, { name: 'Extended', greet() { return 'extended'; } });
    expect(extended.greet()).toBe('extended');
  });
});
