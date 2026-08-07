import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { createParser } from '../index.ts';
import { nextTokenOrNull } from '../cursor.ts';
import { tryParsePattern, parsePattern } from './pattern.ts';
import { getNodeTypeName } from '@nunjucks/nodes';
import { asTokenStream } from '../test-helpers.ts';

const ctxFor = (src: string) => {
  const tk = createTokenizer(`{{ ${src} }}`);
  const ctx = createParser(asTokenStream(tk));
  nextTokenOrNull(ctx);
  return ctx;
};

describe('tryParsePattern', () => {
  test('returns null for non-pattern start (symbol)', () => {
    const ctx = ctxFor('x');
    expect(tryParsePattern(ctx)).toBeNull();
  });
  test('returns null for non-pattern start (number)', () => {
    const ctx = ctxFor('42');
    expect(tryParsePattern(ctx)).toBeNull();
  });
  test('parses array pattern [a, b]', () => {
    const ctx = ctxFor('[a, b]');
    const node = tryParsePattern(ctx);
    expect(node).not.toBeNull();
    expect(getNodeTypeName(node!)).toBe('arrayPattern');
  });
  test('parses object pattern {a, b}', () => {
    const ctx = ctxFor('{a, b}');
    const node = tryParsePattern(ctx);
    expect(node).not.toBeNull();
    expect(getNodeTypeName(node!)).toBe('objectPattern');
  });
});

describe('parsePattern: array destructuring', () => {
  test('simple [a, b]', () => {
    const ctx = ctxFor('[a, b]');
    const node = parsePattern(ctx);
    expect(getNodeTypeName(node!)).toBe('arrayPattern');
  });
  test('with default [a = 1]', () => {
    const ctx = ctxFor('[a = 1]');
    const node = parsePattern(ctx);
    expect(getNodeTypeName(node!)).toBe('arrayPattern');
  });
  test('nested [[a, b], c]', () => {
    const ctx = ctxFor('[[a, b], c]');
    const node = parsePattern(ctx);
    expect(getNodeTypeName(node!)).toBe('arrayPattern');
  });
  test('with rest [...rest]', () => {
    const ctx = ctxFor('[...rest]');
    const node = parsePattern(ctx);
    expect(getNodeTypeName(node!)).toBe('arrayPattern');
  });
  test('trailing comma [a, b,]', () => {
    const ctx = ctxFor('[a, b,]');
    const node = parsePattern(ctx);
    expect(getNodeTypeName(node!)).toBe('arrayPattern');
  });
});

describe('parsePattern: object destructuring', () => {
  test('simple {x, y}', () => {
    const ctx = ctxFor('{x, y}');
    const node = parsePattern(ctx);
    expect(getNodeTypeName(node!)).toBe('objectPattern');
  });
  test('with default {x = 1}', () => {
    const ctx = ctxFor('{x = 1}');
    const node = parsePattern(ctx);
    expect(getNodeTypeName(node!)).toBe('objectPattern');
  });
  test('with key shorthand {a}', () => {
    const ctx = ctxFor('{a}');
    const node = parsePattern(ctx);
    expect(getNodeTypeName(node!)).toBe('objectPattern');
  });
});
