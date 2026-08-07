import { describe, test, expect } from 'bun:test';
import { createState } from '../state.ts';
import { tokenizeWhitespace } from './whitespace.ts';

const run = (src: string, offset = 0) => {
  const state = { ...createState(src), inCode: true, index: offset };
  return tokenizeWhitespace(state);
};

describe('tokenizeWhitespace', () => {
  test('returns null for non-whitespace', () => {
    expect(run('abc')).toBeNull();
  });

  test('single space', () => {
    const r = run(' ');
    expect(r?.token.type).toBe('whitespace');
    expect(r?.token.value).toBe(' ');
  });

  test('mixed run', () => {
    const r = run('  \t\n  ');
    expect(r?.token.value).toBe('  \t\n  ');
  });

  test('preserves position before advancing', () => {
    const r = run(' x', 0);
    expect(r?.token.lineno).toBe(0);
    expect(r?.token.colno).toBe(0);
  });

  test('handles NBSP', () => {
    const r = run('\u00A0');
    expect(r?.token.value).toBe('\u00A0');
  });
});
