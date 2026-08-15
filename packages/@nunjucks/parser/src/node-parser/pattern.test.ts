import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { getNodeTypeName } from '@nunjucks/nodes';
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
