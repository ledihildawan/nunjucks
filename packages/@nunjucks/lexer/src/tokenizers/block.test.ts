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

  test('returns null for non-block-end', () => {
    expect(tokenizeBlockEnd({ ...createState('abc'), inCode: false })).toBeNull();
  });
});

describe('tokenizeBlockEnd trimBlocks', () => {
  test('skips one newline after %}', () => {
    const r = tokenizeBlockEnd({ ...createState('%}\nx'), inCode: false, trimBlocks: true });
    expect(r?.state.index).toBe('%}\n'.length);
  });

  test('skips a CRLF newline after %}', () => {
    const r = tokenizeBlockEnd({ ...createState('%}\r\nx'), inCode: false, trimBlocks: true });
    expect(r?.state.index).toBe('%}\r\n'.length);
  });

  test('keeps a bare CR that is not a CRLF newline', () => {
    const r = tokenizeBlockEnd({ ...createState('%}\rx'), inCode: false, trimBlocks: true });
    expect(r?.state.index).toBe('%}'.length);
  });

  test('does not skip when no newline follows', () => {
    const r = tokenizeBlockEnd({ ...createState('%} x'), inCode: false, trimBlocks: true });
    expect(r?.state.index).toBe('%}'.length);
  });

  test('does not skip when trimBlocks is off', () => {
    const r = tokenizeBlockEnd({ ...createState('%}\nx'), inCode: false });
    expect(r?.state.index).toBe('%}'.length);
  });
});
