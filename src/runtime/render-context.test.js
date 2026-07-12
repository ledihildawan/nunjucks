import { describe, test, expect } from 'bun:test';
import {
  createRenderContext,
  withDefaults,
  withComputed,
  withValidation,
  createIsolatedContext,
  createForkedContext,
  toContext
} from './render-context.js';

describe('createRenderContext', () => {
  test('creates context with initial data', () => {
    const ctx = createRenderContext({ name: 'John', age: 30 });
    expect(ctx.get('name')).toBe('John');
    expect(ctx.get('age')).toBe(30);
  });

  test('get returns undefined for missing key', () => {
    const ctx = createRenderContext({ name: 'John' });
    expect(ctx.get('missing')).toBeUndefined();
  });
});

describe('set', () => {
  test('sets value in current scope', () => {
    const ctx = createRenderContext({});
    ctx.set('name', 'John');
    expect(ctx.get('name')).toBe('John');
  });

  test('overrides value in current scope', () => {
    const ctx = createRenderContext({ name: 'John' });
    ctx.set('name', 'Jane');
    expect(ctx.get('name')).toBe('Jane');
  });
});

describe('fork', () => {
  test('fork creates child scope', () => {
    const parent = createRenderContext({ name: 'John' });
    const child = parent.clone().fork({ age: 30 });
    
    expect(child.get('name')).toBe('John');
    expect(child.get('age')).toBe(30);
  });

  test('child set does not affect parent', () => {
    const parent = createRenderContext({ name: 'John' });
    const child = parent.clone().fork({});
    child.set('name', 'Jane');
    
    expect(parent.get('name')).toBe('John');
    expect(child.get('name')).toBe('Jane');
  });

  test('fork with initial data', () => {
    const parent = createRenderContext({ name: 'John' });
    const child = parent.clone().fork({ age: 30 });
    
    expect(child.get('name')).toBe('John');
    expect(child.get('age')).toBe(30);
  });

  test('multiple fork levels', () => {
    const root = createRenderContext({ level: 0 });
    const level1 = root.clone().fork({ level: 1 });
    const level2 = level1.clone().fork({ level: 2 });
    const level3 = level2.clone().fork({ level: 3 });
    
    expect(level3.get('level')).toBe(3);
    expect(level2.get('level')).toBe(2);
    expect(level1.get('level')).toBe(1);
    expect(root.get('level')).toBe(0);
  });
});

describe('merge', () => {
  test('merges data to current scope', () => {
    const ctx = createRenderContext({ name: 'John' });
    ctx.merge({ age: 30, city: 'NYC' });
    
    expect(ctx.get('name')).toBe('John');
    expect(ctx.get('age')).toBe(30);
    expect(ctx.get('city')).toBe('NYC');
  });
});

describe('delete', () => {
  test('deletes from current scope only', () => {
    const parent = createRenderContext({ name: 'John' });
    const child = parent.clone().fork({ age: 30 });
    
    child.delete('age');
    
    expect(child.get('age')).toBeUndefined();
    expect(parent.get('name')).toBe('John');
    expect(parent.get('age')).toBeUndefined();
  });
});

describe('toObject', () => {
  test('converts to plain object', () => {
    const parent = createRenderContext({ name: 'John' });
    const child = parent.clone().fork({ age: 30 });
    
    const obj = child.toObject();
    
    expect(obj).toEqual({ name: 'John', age: 30 });
  });

  test('child data overrides parent', () => {
    const parent = createRenderContext({ name: 'John', role: 'user' });
    const child = parent.clone().fork({ role: 'admin' });
    
    const obj = child.toObject();
    
    expect(obj.name).toBe('John');
    expect(obj.role).toBe('admin');
  });
});

describe('has', () => {
  test('checks current and parent scopes', () => {
    const parent = createRenderContext({ name: 'John' });
    const child = parent.clone().fork({ age: 30 });
    
    expect(child.has('name')).toBe(true);
    expect(child.has('age')).toBe(true);
    expect(child.has('missing')).toBe(false);
  });
});

describe('clone', () => {
  test('creates independent copy', () => {
    const original = createRenderContext({ name: 'John' });
    const copy = original.clone();
    
    copy.set('name', 'Jane');
    
    expect(original.get('name')).toBe('John');
    expect(copy.get('name')).toBe('Jane');
  });
});

describe('composables - withDefaults', () => {
  test('adds defaults for missing keys', () => {
    const ctx = createRenderContext({ name: 'John' });
    const withDefaultsCtx = withDefaults({ age: 30, city: 'NYC' })(ctx);
    
    expect(withDefaultsCtx.get('name')).toBe('John');
    expect(withDefaultsCtx.get('age')).toBe(30);
    expect(withDefaultsCtx.get('city')).toBe('NYC');
  });

  test('does not override existing keys', () => {
    const ctx = createRenderContext({ name: 'John' });
    const withDefaultsCtx = withDefaults({ name: 'Jane' })(ctx);
    
    expect(withDefaultsCtx.get('name')).toBe('John');
  });
});

describe('composables - withComputed', () => {
  test('adds computed values', () => {
    const ctx = createRenderContext({ firstName: 'John', lastName: 'Doe' });
    const withComputedCtx = withComputed({
      fullName: (c) => `${c.get('firstName')} ${c.get('lastName')}`,
      nameUpper: (c) => c.get('firstName').toUpperCase()
    })(ctx);
    
    expect(withComputedCtx.get('fullName')).toBe('John Doe');
    expect(withComputedCtx.get('nameUpper')).toBe('JOHN');
  });
});

describe('composables - withValidation', () => {
  test('throws on invalid value', () => {
    const ctx = createRenderContext({ age: 30 });
    const validateCtx = withValidation({
      age: (v) => typeof v === 'number' && v > 0
    })(ctx);
    
    expect(() => validateCtx.set('age', -1)).toThrow();
  });

  test('allows valid value', () => {
    const ctx = createRenderContext({ age: 30 });
    const validateCtx = withValidation({
      age: (v) => typeof v === 'number' && v > 0
    })(ctx);
    
    expect(() => validateCtx.set('age', 25)).not.toThrow();
  });
});

describe('toContext', () => {
  test('converts plain object to context', () => {
    const ctx = toContext({ name: 'John' });
    expect(ctx.get('name')).toBe('John');
  });

  test('returns same context if already context', () => {
    const original = createRenderContext({ name: 'John' });
    const converted = toContext(original);
    expect(converted).toBe(original);
  });

  test('handles null/undefined', () => {
    const ctx1 = toContext(null);
    expect(ctx1.get('any')).toBeUndefined();
    
    const ctx2 = toContext(undefined);
    expect(ctx2.get('any')).toBeUndefined();
  });
});

describe('createIsolatedContext', () => {
  test('creates empty context', () => {
    const ctx = createIsolatedContext();
    expect(ctx.get('any')).toBeUndefined();
  });
});

describe('createForkedContext', () => {
  test('forks parent with additional data', () => {
    const parent = createRenderContext({ name: 'John' });
    const forked = createForkedContext(parent, { age: 30 });
    
    expect(forked.get('name')).toBe('John');
    expect(forked.get('age')).toBe(30);
  });

  test('does not modify parent', () => {
    const parent = createRenderContext({ name: 'John' });
    createForkedContext(parent, { age: 30 });
    
    expect(parent.get('age')).toBeUndefined();
  });
});
