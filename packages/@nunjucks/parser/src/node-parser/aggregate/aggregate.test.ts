import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { createParser } from '../../index.ts';
import { nextTokenOrNull } from '../../cursor.ts';
import { parsePrimary } from '../../expression-parser/index.ts';
import { getNodeTypeName, isChildrenNode } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { asTokenStream } from '../../test-helpers.ts';

const childrenOf = (node: Node): readonly Node[] =>
  isChildrenNode(node) ? node.children : [];

const ctxFor = (src: string) => {
  const tk = createTokenizer(`{{ ${src} }}`);
  const ctx = createParser(asTokenStream(tk));
  nextTokenOrNull(ctx);
  return ctx;
};

const parsePrim = (src: string): Node => parsePrimary(ctxFor(src));

describe('parse-list / parse-expressions aggregates', () => {
  test('array with trailing comma', () => {
    const node = parsePrim('[1, 2,]');
    expect(getNodeTypeName(node)).toBe('array');
  });

  test('array holes produce comma placeholders', () => {
    const node = parsePrim('[1,,3]');
    expect(getNodeTypeName(node)).toBe('array');
    expect(childrenOf(node)).toHaveLength(3);
  });

  test('array with spread', () => {
    const node = parsePrim('[x, ...rest]');
    expect(getNodeTypeName(node)).toBe('array');
  });

  test('dict with explicit pairs', () => {
    const node = parsePrim('{a: 1, b: 2}');
    expect(getNodeTypeName(node)).toBe('dict');
    expect(childrenOf(node)).toHaveLength(2);
  });

  test('dict with shorthand keys', () => {
    const node = parsePrim('{a, b}');
    expect(getNodeTypeName(node)).toBe('dict');
  });

  test('dict with default values (assignment patterns)', () => {
    const node = parsePrim('{a = 1}');
    expect(getNodeTypeName(node)).toBe('dict');
  });

  test('dict with spread', () => {
    const node = parsePrim('{...base, a: 1}');
    expect(getNodeTypeName(node)).toBe('dict');
  });

  test('throws when a dict key is missing a colon', () => {
    expect(() => parsePrim('{a ?}')).toThrow();
  });

  test('throws on a missing comma between elements', () => {
    expect(() => parsePrim('[1 2]')).toThrow();
  });

  test('group parses a parenthesized expression', () => {
    const node = parsePrim('(1 + 2)');
    expect(getNodeTypeName(node)).toBe('group');
  });
});