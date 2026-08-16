import { describe, expect, test } from 'bun:test';
import { createState } from '../state.ts';
import { tokenizeComment } from './comment.ts';

const run = (src: string) => tokenizeComment({ ...createState(src), inCode: false });

describe('tokenizeComment', () => {
  test('returns null for non-comment', () => {
    expect(run('{{ x }}')).toBeNull();
  });

  test('basic comment', () => {
    const r = run('{# hello #}');
    expect(r?.token.type).toBe('comment');
    expect(r?.token.value).toBe('{# hello #}');
  });

  test('comment containing tag-like content', () => {
    const r = run('{# {{ x }} #}');
    expect(r?.token.value).toBe('{# {{ x }} #}');
  });

  test('unterminated comment throws UNTERMINATED_LITERAL', () => {
    expect(() => run('{# no end')).toThrow(/Unterminated comment literal/);
  });
});
