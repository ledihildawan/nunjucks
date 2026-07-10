import { expect, describe, test } from 'bun:test';
import { Obj, EmitterObj } from './index.js';

describe('Obj', () => {
  test('constructs and calls init', () => {
    let inited = false;
    class Test extends Obj {
      init() { inited = true; }
    }
    new Test();
    expect(inited).toBe(true);
  });

  test('typename defaults to constructor name', () => {
    class Foo extends Obj {}
    expect(new Foo().typename).toBe('Foo');
  });

  test('extend creates subclass with typename', () => {
    const MyType = Obj.extend('MyType');
    const inst = new MyType();
    expect(inst).toBeInstanceOf(Obj);
    expect(inst.typename).toBe('MyType');
  });

  test('extend with props adds methods', () => {
    const Greeter = Obj.extend('Greeter', {
      hello() { return 'hi'; }
    });
    expect(new Greeter().hello()).toBe('hi');
  });

  test('extend wraps parent method', () => {
    const Base = Obj.extend('Base', {
      greet() { return 'base'; }
    });
    const Child = Base.extend('Child', {
      greet() { return this.parent() + ' child'; }
    });
    expect(new Child().greet()).toBe('base child');
  });

  test('extend with anonymous name', () => {
    const Anon = Obj.extend({ foo() { return 1; } });
    expect(new Anon().typename).toBe('anonymous');
  });
});

describe('EmitterObj', () => {
  test('constructs and calls init', () => {
    let inited = false;
    class Test extends EmitterObj {
      init() { inited = true; }
    }
    new Test();
    expect(inited).toBe(true);
  });

  test('typename defaults to constructor name', () => {
    class Foo extends EmitterObj {}
    expect(new Foo().typename).toBe('Foo');
  });

  test('extends EventEmitter', () => {
    const inst = new (class extends EmitterObj {})();
    let emitted = false;
    inst.on('test', () => { emitted = true; });
    inst.emit('test');
    expect(emitted).toBe(true);
  });

  test('extend creates subclass with typename', () => {
    const MyType = EmitterObj.extend('MyEmitter');
    const inst = new MyType();
    expect(inst).toBeInstanceOf(EmitterObj);
    expect(inst.typename).toBe('MyEmitter');
  });

  test('extend with props overrides init', () => {
    let val = 0;
    const InitType = EmitterObj.extend('InitType', {
      init() { val = 42; }
    });
    new InitType();
    expect(val).toBe(42);
  });
});
