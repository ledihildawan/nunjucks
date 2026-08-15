import { describe, expect, test } from 'bun:test';
import { createState } from '../state.ts';
import { tokenizeBlockEnd, tokenizeBlockStart } from './block.ts';

const run = (src: string) => tokenizeBlockStart({ ...createState(src), inCode: false });

describe('tokenizeBlockStart', () => {
  test('plain {%', () => {
    const r = run('{%');
    expect(r?.token.type).toBe('block-start');
    expect(r?.token.value).toBe('{%');
  });

  test('strip {%-', () => {
    const r = run('{%-');
    expect(r?.token.type).toBe('block-start');
    expect(r?.token.stripLeft).toBe(true);
  });

  test('returns null for non-block', () => {
    expect(run('abc')).toBeNull();
  });
});

describe('tokenizeBlockEnd', () => {
  test('plain %}', () => {
    const r = tokenizeBlockEnd({ ...createState('%}'), inCode: false });
    expect(r?.token.type).toBe('block-end');
  });

  test('strip -%}', () => {
    const r = tokenizeBlockEnd({ ...createState('-%}'), inCode: false });
    expect(r?.token.stripRight).toBe(true);
  });
});
