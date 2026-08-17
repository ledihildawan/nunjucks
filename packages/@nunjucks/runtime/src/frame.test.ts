import { describe, expect, test } from 'bun:test';
import { createFrame } from './frame.ts';

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

  test('get returns undefined for unset variable', () => {
    const f = createFrame();
    expect(f.get('missing')).toBeUndefined();
  });

  test('set stores nested dotted path', () => {
    let f = createFrame();
    f = f.set({ name: 'user.name', value: 'Bob' });
    expect(f.get('user')).toEqual({ name: 'Bob' });
  });

  test('nested set replaces a non-object child with a fresh object', () => {
    let f = createFrame();
    f = f.set({ name: 'user', value: 'alice' });
    f = f.set({ name: 'user.name', value: 'bob' });
    expect(f.get('user')).toEqual({ name: 'bob' });
  });

  test('set with resolveUp writes to parent frame', () => {
    let parent = createFrame();
    parent = parent.set({ name: 'existing', value: 'val' });
    let f = createFrame({ parent });
    f = f.set({ name: 'existing', value: 'newval', resolveUp: true });
    expect(f.lookup('existing')).toBe('newval');
    expect(f.get('existing')).toBeUndefined();
  });

  test('set with resolveUp uses own frame if parent has no match', () => {
    const parent = createFrame();
    let f = createFrame({ parent });
    f = f.set({ name: 'own', value: 'val', resolveUp: true });
    expect(parent.get('own')).toBeUndefined();
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

  test('resolve with forWrite=true stops at an isolated ancestor beyond the parent', () => {
    let grandparent = createFrame();
    grandparent = grandparent.set({ name: 'x', value: 1 });
    const parent = grandparent.push(true);
    const child = parent.push();
    expect(child.resolve('x', true)).toBeUndefined();
    expect(child.resolve('x')).toBe(grandparent);
  });

  test('push creates child frame', () => {
    let f = createFrame();
    f = f.set({ name: 'x', value: 1 });
    const child = f.push();
    expect(child.parent).toBe(f);
    expect(child.lookup('x')).toBe(1);
  });

  test('push applies the write-isolation argument to the child frame', () => {
    const f = createFrame({ isolateWrites: true });
    const child = f.push(true);
    expect(child.isolateWrites).toBe(true);
    expect(f.push().isolateWrites).toBeUndefined();
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

  test('prototype-escape keys never resolve after an immutable set rebuilds variables', () => {
    let frame = createFrame();
    frame = frame.set({ name: 'x', value: 1 });
    expect(frame.get('constructor')).toBeUndefined();
    expect(frame.get('__proto__')).toBeUndefined();
    expect(frame.get('prototype')).toBeUndefined();
    expect(frame.lookup('constructor')).toBeUndefined();
    expect(frame.lookup('__proto__')).toBeUndefined();
    expect(frame.resolve('constructor')).toBeUndefined();
  });

  test('an own prototype-escape binding still resolves (identifier named constructor)', () => {
    let frame = createFrame();
    frame = frame.set({ name: 'constructor', value: 42 });
    expect(frame.get('constructor')).toBe(42);
    expect(frame.lookup('constructor')).toBe(42);
    expect(frame.resolve('constructor')).toBe(frame);
  });
});
