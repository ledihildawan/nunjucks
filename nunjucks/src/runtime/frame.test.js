import { describe, test, expect } from 'bun:test';
import { Frame } from './frame.js';

describe('Frame', () => {
  test('constructor initializes empty variables', () => {
    const f = new Frame();
    expect(f.variables).toBeDefined();
    expect(f.parent).toBeUndefined();
    expect(f.topLevel).toBe(false);
  });

  test('constructor sets parent and isolateWrites', () => {
    const parent = new Frame();
    const f = new Frame(parent, true);
    expect(f.parent).toBe(parent);
    expect(f.isolateWrites).toBe(true);
  });

  test('set stores a value', () => {
    const f = new Frame();
    f.set('name', 'Alice');
    expect(f.get('name')).toBe('Alice');
  });

  test('get returns null for unset variable', () => {
    const f = new Frame();
    expect(f.get('missing')).toBeNull();
  });

  test('set stores nested dotted path', () => {
    const f = new Frame();
    f.set('user.name', 'Bob');
    expect(f.get('user')).toEqual({ name: 'Bob' });
  });

  test('set with resolveUp writes to parent frame', () => {
    const parent = new Frame();
    parent.set('existing', 'val');
    const f = new Frame(parent);
    f.set('existing', 'newval', true);
    expect(parent.get('existing')).toBe('newval');
  });

  test('set with resolveUp uses own frame if parent has no match', () => {
    const parent = new Frame();
    const f = new Frame(parent);
    f.set('own', 'val', true);
    expect(parent.get('own')).toBeNull();
    expect(f.get('own')).toBe('val');
  });

  test('lookup finds own variables', () => {
    const f = new Frame();
    f.set('x', 1);
    expect(f.lookup('x')).toBe(1);
  });

  test('lookup finds parent variables', () => {
    const parent = new Frame();
    parent.set('x', 1);
    const f = new Frame(parent);
    expect(f.lookup('x')).toBe(1);
  });

  test('lookup prefers own variable over parent', () => {
    const parent = new Frame();
    parent.set('x', 1);
    const f = new Frame(parent);
    f.set('x', 2);
    expect(f.lookup('x')).toBe(2);
  });

  test('lookup returns undefined for missing', () => {
    const f = new Frame();
    expect(f.lookup('missing')).toBeUndefined();
  });

  test('resolve returns frame that owns the variable', () => {
    const parent = new Frame();
    parent.set('x', 1);
    const f = new Frame(parent);
    expect(f.resolve('x')).toBe(parent);
  });

  test('resolve returns own frame for own variable', () => {
    const f = new Frame();
    f.set('x', 1);
    expect(f.resolve('x')).toBe(f);
  });

  test('resolve returns undefined for missing variable', () => {
    const f = new Frame();
    expect(f.resolve('missing')).toBeUndefined();
  });

  test('resolve with forWrite=true and isolateWrites stops at own frame', () => {
    const parent = new Frame();
    parent.set('x', 1);
    const f = new Frame(parent, true);
    expect(f.resolve('x', true)).toBeUndefined();
  });

  test('resolve with forWrite=false ignores isolateWrites', () => {
    const parent = new Frame();
    parent.set('x', 1);
    const f = new Frame(parent, true);
    expect(f.resolve('x')).toBe(parent);
  });

  test('push creates child frame', () => {
    const f = new Frame();
    f.set('x', 1);
    const child = f.push();
    expect(child.parent).toBe(f);
    expect(child.lookup('x')).toBe(1);
  });

  test('push propagates isolateWrites', () => {
    const f = new Frame(null, true);
    const child = f.push(true);
    expect(child.isolateWrites).toBe(true);
  });

  test('pop returns parent', () => {
    const parent = new Frame();
    const child = new Frame(parent);
    expect(child.pop()).toBe(parent);
  });

  test('pop on root frame returns undefined', () => {
    const f = new Frame();
    expect(f.pop()).toBeUndefined();
  });

  test('topLevel defaults to false', () => {
    const f = new Frame();
    expect(f.topLevel).toBe(false);
  });
});
