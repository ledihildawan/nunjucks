import { describe, test, expect } from 'bun:test';
import { createFrame } from '@nunjucks/runtime/frame';

describe('Frame', () => {
  test('constructor initializes empty variables', () => {
    const f = createFrame();
    expect(f.variables).toBeDefined();
    expect(f.parent).toBeUndefined();
    expect(f.topLevel).toBe(false);
  });

  test('constructor sets parent and isolateWrites', () => {
    const parent = createFrame();
    const f = createFrame({ parent, isolateWrites: true });
    expect(f.parent).toBe(parent);
    expect(f.isolateWrites).toBe(true);
  });

  test('set stores a value', () => {
    let f = createFrame();
    f = f.set({ name: 'name', value: 'Alice' });
    expect(f.get('name')).toBe('Alice');
  });

  test('get returns null for unset variable', () => {
    const f = createFrame();
    expect(f.get('missing')).toBeNull();
  });

  test('set stores nested dotted path', () => {
    let f = createFrame();
    f = f.set({ name: 'user.name', value: 'Bob' });
    expect(f.get('user')).toEqual({ name: 'Bob' });
  });

  test('set with resolveUp writes to parent frame', () => {
    let parent = createFrame();
    parent = parent.set({ name: 'existing', value: 'val' });
    let f = createFrame({ parent });
    f = f.set({ name: 'existing', value: 'newval', resolveUp: true });
    expect(f.lookup('existing')).toBe('newval');
    expect(f.get('existing')).toBeNull();
  });

  test('set with resolveUp uses own frame if parent has no match', () => {
    const parent = createFrame();
    let f = createFrame({ parent });
    f = f.set({ name: 'own', value: 'val', resolveUp: true });
    expect(parent.get('own')).toBeNull();
    expect(f.get('own')).toBe('val');
  });

  test('lookup finds own variables', () => {
    let f = createFrame();
    f = f.set({ name: 'x', value: 1 });
    expect(f.lookup('x')).toBe(1);
  });

  test('lookup finds parent variables', () => {
    let parent = createFrame();
    parent = parent.set({ name: 'x', value: 1 });
    const f = createFrame({ parent });
    expect(f.lookup('x')).toBe(1);
  });

  test('lookup prefers own variable over parent', () => {
    let parent = createFrame();
    parent = parent.set({ name: 'x', value: 1 });
    let f = createFrame({ parent });
    f = f.set({ name: 'x', value: 2 });
    expect(f.lookup('x')).toBe(2);
  });

  test('lookup returns undefined for missing', () => {
    const f = createFrame();
    expect(f.lookup('missing')).toBeUndefined();
  });

  test('resolve returns frame that owns the variable', () => {
    let parent = createFrame();
    parent = parent.set({ name: 'x', value: 1 });
    const f = createFrame({ parent });
    expect(f.resolve('x')).toBe(parent);
  });

  test('resolve returns own frame for own variable', () => {
    let f = createFrame();
    f = f.set({ name: 'x', value: 1 });
    expect(f.resolve('x')).toBe(f);
  });

  test('resolve returns undefined for missing variable', () => {
    const f = createFrame();
    expect(f.resolve('missing')).toBeUndefined();
  });

  test('resolve with forWrite=true and isolateWrites stops at own frame', () => {
    let parent = createFrame();
    parent = parent.set({ name: 'x', value: 1 });
    const f = createFrame({ parent, isolateWrites: true });
    expect(f.resolve('x', true)).toBeUndefined();
  });

  test('resolve with forWrite=false ignores isolateWrites', () => {
    let parent = createFrame();
    parent = parent.set({ name: 'x', value: 1 });
    const f = createFrame({ parent, isolateWrites: true });
    expect(f.resolve('x')).toBe(parent);
  });

  test('push creates child frame', () => {
    let f = createFrame();
    f = f.set({ name: 'x', value: 1 });
    const child = f.push();
    expect(child.parent).toBe(f);
    expect(child.lookup('x')).toBe(1);
  });

  test('push propagates isolateWrites', () => {
    const f = createFrame({ isolateWrites: true });
    const child = f.push(true);
    expect(child.isolateWrites).toBe(true);
  });

  test('pop returns parent', () => {
    const parent = createFrame();
    const child = createFrame({ parent });
    expect(child.pop()).toBe(parent);
  });

  test('pop on root frame returns undefined', () => {
    const f = createFrame();
    expect(f.pop()).toBeUndefined();
  });

  test('topLevel defaults to false', () => {
    const f = createFrame();
    expect(f.topLevel).toBe(false);
  });
});
