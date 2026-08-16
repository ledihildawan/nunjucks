import { describe, test, expect } from 'bun:test';
import { createGensym } from './gensym.ts';

describe('createGensym', () => {
  test('starts the counter at zero with the given prefix', () => {
    expect(createGensym('sym')()).toBe('sym_0');
    expect(createGensym('gen')()).toBe('gen_0');
  });

  test('increments monotonically on successive calls', () => {
    const nextId = createGensym('uid');
    expect(nextId()).toBe('uid_0');
    expect(nextId()).toBe('uid_1');
    expect(nextId()).toBe('uid_2');
  });

  test('never repeats an identifier within one generator', () => {
    const nextId = createGensym('uniq');
    const ids = Array.from({ length: 10 }, () => nextId());
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('keeps counters independent across generators', () => {
    const first = createGensym('a');
    const second = createGensym('a');
    first();
    first();
    expect(second()).toBe('a_0');
  });
});
