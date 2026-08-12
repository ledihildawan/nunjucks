import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { createParser } from '../index.ts';
import { nextTokenOrNull } from '../cursor.ts';
import { parseSignature } from './index.ts';
import { getNodeTypeName } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { asTokenStream, unwrap } from '../test-helpers.ts';

const ctxFor = (src: string) => {
  const tk = createTokenizer(`{{ ${src} }}`);
  const ctx = createParser(asTokenStream(tk));
  nextTokenOrNull(ctx);
  return ctx;
};

const parseSig = (src: string, tolerant?: boolean, noParens?: boolean): Node | null =>
  unwrap(parseSignature({ parserContext: ctxFor(src), tolerant, noParens }));

describe('parseSignature', () => {
  test('returns null for tolerant mode without a left paren', () => {
    expect(parseSig('x', true)).toBeNull();
  });

  test('throws for non-tolerant without a left paren', () => {
    expect(() => parseSig('x', false)).toThrow();
  });

  test('parses an empty parenthesized signature', () => {
    const sig = parseSig('()');
    expect(sig).not.toBeNull();
    expect(getNodeTypeName(sig as Node)).toBe('nodeList');
    expect(sig?.children).toHaveLength(0);
  });

  test('parses positional arguments', () => {
    const sig = parseSig('(1, 2)');
    expect(sig?.children).toHaveLength(2);
  });

  test('parses keyword arguments as an appended children node list', () => {
    const sig = parseSig('(a=1, b=2)');
    expect(sig?.children).toHaveLength(1);
  });

  test('mixes positional and keyword arguments', () => {
    const sig = parseSig('(0, a=1)');
    expect(sig?.children).toHaveLength(2);
  });
});