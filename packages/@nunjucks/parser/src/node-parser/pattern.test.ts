import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import type { Node } from '@nunjucks/nodes';
import { getNodeTypeName, isHole } from '@nunjucks/nodes';
import { nextTokenOrNull } from '../cursor.ts';
import { createParser } from '../index.ts';
import { unwrap } from '../test-helpers.ts';
import { parsePattern, tryParsePattern } from './pattern.ts';

const ctxFor = (src: string) => {
  const tk = createTokenizer(`{{ ${src} }}`);
  const ctx = createParser(tk);
  nextTokenOrNull(ctx);
  return ctx;
};

describe('tryParsePattern', () => {
  test('returns null for non-pattern start (symbol)', () => {
    const ctx = ctxFor('x');
    expect(unwrap(tryParsePattern(ctx))).toBeNull();
  });
  test('returns null for non-pattern start (number)', () => {
    const ctx = ctxFor('42');
    expect(unwrap(tryParsePattern(ctx))).toBeNull();
  });
  test('parses array pattern [a, b]', () => {
    const ctx = ctxFor('[a, b]');
    const node = unwrap(tryParsePattern(ctx));
    expect(node).not.toBeNull();
    expect(getNodeTypeName(node!)).toBe('arrayPattern');
  });
  test('parses object pattern {a, b}', () => {
    const ctx = ctxFor('{a, b}');
    const node = unwrap(tryParsePattern(ctx));
    expect(node).not.toBeNull();
    expect(getNodeTypeName(node!)).toBe('objectPattern');
  });
});

describe('parsePattern: array destructuring', () => {
  test('simple [a, b]', () => {
    const ctx = ctxFor('[a, b]');
    const node = unwrap(parsePattern(ctx));
    expect(getNodeTypeName(node!)).toBe('arrayPattern');
  });
  test('with default [a = 1]', () => {
    const ctx = ctxFor('[a = 1]');
    const node = unwrap(parsePattern(ctx));
    expect(getNodeTypeName(node!)).toBe('arrayPattern');
  });
  test('nested [[a, b], c]', () => {
    const ctx = ctxFor('[[a, b], c]');
    const node = unwrap(parsePattern(ctx));
    expect(getNodeTypeName(node!)).toBe('arrayPattern');
  });
  test('with rest [...rest]', () => {
    const ctx = ctxFor('[...rest]');
    const node = unwrap(parsePattern(ctx));
    expect(getNodeTypeName(node!)).toBe('arrayPattern');
  });
  test('trailing comma [a, b,]', () => {
    const ctx = ctxFor('[a, b,]');
    const node = unwrap(parsePattern(ctx));
    expect(getNodeTypeName(node!)).toBe('arrayPattern');
  });
  test('holes [a, , b] produce hole elements', () => {
    // WHY: regression — holes were only supported in aggregate/walrus patterns; for
    // and match patterns failed with "expected symbol in pattern".
    const ctx = ctxFor('[a, , b]');
    const node = unwrap(parsePattern(ctx));
    const children = (node as { children: readonly Node[] }).children;
    expect(children).toHaveLength(3);
    expect(isHole(children[1]!)).toBe(true);
  });
  test('multiple holes [a, , , b] and trailing hole [a, , ]', () => {
    const twoHoles = unwrap(parsePattern(ctxFor('[a, , , b]'))) as {
      children: readonly Node[];
    };
    expect(twoHoles.children).toHaveLength(4);
    expect(isHole(twoHoles.children[1]!)).toBe(true);
    expect(isHole(twoHoles.children[2]!)).toBe(true);
    const trailing = unwrap(parsePattern(ctxFor('[a, , ]'))) as {
      children: readonly Node[];
    };
    expect(trailing.children).toHaveLength(2);
    expect(isHole(trailing.children[1]!)).toBe(true);
  });
  test('rejects an element after rest [a, ...r b]', () => {
    // WHY: regression — post-rest comma validation was skipped entirely, so junk after
    // `...r` parsed as another element instead of failing.
    expect(() => unwrap(parsePattern(ctxFor('[a, ...r b]')))).toThrow(/last element/);
  });
  test('rejects an element after a post-rest comma [a, ...r, b]', () => {
    expect(() => unwrap(parsePattern(ctxFor('[a, ...r, b]')))).toThrow(/last element/);
  });
  test('accepts a trailing comma after rest [a, ...r,]', () => {
    const node = unwrap(parsePattern(ctxFor('[a, ...r,]')));
    expect(getNodeTypeName(node!)).toBe('arrayPattern');
  });
});

describe('parsePattern: object destructuring', () => {
  test('simple {x, y}', () => {
    const ctx = ctxFor('{x, y}');
    const node = unwrap(parsePattern(ctx));
    expect(getNodeTypeName(node!)).toBe('objectPattern');
  });
  test('with default {x = 1}', () => {
    const ctx = ctxFor('{x = 1}');
    const node = unwrap(parsePattern(ctx));
    expect(getNodeTypeName(node!)).toBe('objectPattern');
  });
  test('with key shorthand {a}', () => {
    const ctx = ctxFor('{a}');
    const node = unwrap(parsePattern(ctx));
    expect(getNodeTypeName(node!)).toBe('objectPattern');
  });
});
