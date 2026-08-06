import { describe, test, expect } from 'bun:test';
import { createState, getChar, getPeek, isFinished, advance, matches } from './state.ts';

describe('createState', () => {
  test('initialises with defaults', () => {
    const s = createState('abc');
    expect(s.index).toBe(0);
    expect(s.lineno).toBe(0);
    expect(s.colno).toBe(0);
    expect(s.inCode).toBe(false);
    expect(s.trimBlocks).toBe(false);
    expect(s.lstripBlocks).toBe(false);
  });
});

describe('getChar / getPeek', () => {
  test('read current and next char', () => {
    const s = createState('abc');
    expect(getChar(s)).toBe('a');
    expect(getPeek(s)).toBe('b');
  });

  test('return empty string at end of input', () => {
    const s = createState('a');
    expect(getPeek(s)).toBe('');
    const end = advance(s, 1);
    expect(getChar(end)).toBe('');
  });
});

describe('isFinished', () => {
  test('true once index reaches the end', () => {
    const s = createState('ab');
    expect(isFinished(s)).toBe(false);
    expect(isFinished(advance(s, 2))).toBe(true);
  });
});

describe('advance', () => {
  test('moves the index forward and returns a new state', () => {
    const s = createState('abc');
    const next = advance(s);
    expect(next.index).toBe(1);
    expect(s.index).toBe(0);
    expect(getChar(next)).toBe('b');
  });

  test('clamps to the string length', () => {
    const s = createState('ab');
    expect(advance(s, 99).index).toBe(2);
  });

  test('tracks line and column across newlines', () => {
    const s = createState('ab\ncd');
    const advanced = advance(s, 4);
    expect(advanced.lineno).toBe(1);
    expect(advanced.colno).toBe(1);
  });
});

describe('matches', () => {
  test('true when the upcoming text matches', () => {
    expect(matches(createState('hello'), 'hel')).toBe(true);
  });

  test('false on mismatch or insufficient remaining input', () => {
    expect(matches(createState('abc'), 'xyz')).toBe(false);
    expect(matches(createState('ab'), 'abcdef')).toBe(false);
  });
});
