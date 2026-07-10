import { describe, test, expect } from 'bun:test';
import { createContainer, createScopedContainer, createContainerWithDefaults, createLazyProxy } from './container.js';

describe('createContainer', () => {
  test('registers and resolves factory', () => {
    const container = createContainer();
    container.register('greeting', () => 'Hello');

    const result = container.resolve('greeting');
    expect(result).toBe('Hello');
  });

  test('registers factory with dependencies', () => {
    const container = createContainer();
    container.register('first', () => 'A');
    container.register('second', (first) => first + ' B');

    const result = container.resolve('second');
    expect(result).toBe('A B');
  });

  test('registers and resolves singleton', () => {
    const container = createContainer();
    let count = 0;
    container.register('counter', () => ++count, { singleton: true });

    const first = container.resolve('counter');
    const second = container.resolve('counter');

    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(first).toBe(second);
  });

  test('resolves non-singleton factory multiple times', () => {
    const container = createContainer();
    let count = 0;
    container.register('counter', () => ++count);

    const first = container.resolve('counter');
    const second = container.resolve('counter');

    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(first).not.toBe(second);
  });

  test('registers and resolves instance', () => {
    const container = createContainer();
    const obj = { value: 42 };
    container.registerInstance('config', obj);

    const result = container.resolve('config');
    expect(result).toBe(obj);
    expect(result.value).toBe(42);
  });

  test('throws for unregistered dependency', () => {
    const container = createContainer();
    expect(() => container.resolve('missing')).toThrow("Container: 'missing' is not registered");
  });

  test('checks if dependency is registered', () => {
    const container = createContainer();
    container.register('exists', () => 'value');

    expect(container.has('exists')).toBe(true);
    expect(container.has('missing')).toBe(false);
  });

  test('removes dependency', () => {
    const container = createContainer();
    container.register('test', () => 'value');
    container.remove('test');

    expect(container.has('test')).toBe(false);
  });

  test('clears all dependencies', () => {
    const container = createContainer();
    container.register('a', () => 'A');
    container.register('b', () => 'B');
    container.clear();

    expect(container.has('a')).toBe(false);
    expect(container.has('b')).toBe(false);
  });

  test('returns registered names', () => {
    const container = createContainer();
    container.register('a', () => 'A');
    container.register('b', () => 'B');

    const registered = container.getRegistered();
    expect(registered).toContain('a');
    expect(registered).toContain('b');
  });

  test('supports fluent API', () => {
    const container = createContainer()
      .register('a', () => 'A')
      .register('b', () => 'B');

    expect(container.resolve('a')).toBe('A');
    expect(container.resolve('b')).toBe('B');
  });

  test('throws for non-function factory', () => {
    const container = createContainer();
    expect(() => container.register('invalid', 'not a function')).toThrow('must be a function');
  });
});

describe('createScopedContainer', () => {
  test('creates scoped container', () => {
    const parent = createContainer();
    parent.register('value', () => ({ id: 1 }));

    const scope = createScopedContainer(parent);
    const result = scope.resolve('value');

    expect(result.id).toBe(1);
  });

  test('scoped container creates new scope', () => {
    const parent = createContainer();
    parent.register('value', () => ({ scope: 'parent' }));

    const scope1 = createScopedContainer(parent);
    const scope2 = createScopedContainer(parent);

    const val1 = scope1.resolve('value');
    const val2 = scope2.resolve('value');

    expect(val1.scope).toBe('parent');
    expect(val2.scope).toBe('parent');
  });
});

describe('createContainerWithDefaults', () => {
  test('creates container with default factories', () => {
    const container = createContainerWithDefaults({
      greeting: () => 'Hello',
      count: 42
    });

    expect(container.resolve('greeting')).toBe('Hello');
    expect(container.resolve('count')).toBe(42);
  });
});

describe('createLazyProxy', () => {
  test('creates lazy proxy', () => {
    let initialized = false;
    const factory = () => {
      initialized = true;
      return { value: 42 };
    };

    const proxy = createLazyProxy(factory);
    expect(initialized).toBe(false);

    const result = proxy.value;
    expect(initialized).toBe(true);
    expect(result).toBe(42);
  });
});
