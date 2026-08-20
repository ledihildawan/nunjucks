import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import type { Node, TemplateLiteralNode } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes';
import { nextTokenOrNull } from '../cursor.ts';
import { createParser } from '../index.ts';
import { unwrap } from '../test-helpers.ts';
import { parseTemplateLiteral } from './template-literal.ts';

const ctxFor = (src: string) => {
  const tk = createTokenizer(`{{ ${src} }}`);
  const ctx = createParser(tk);
  nextTokenOrNull(ctx);
  return ctx;
};

const parseLit = (src: string): Node | null => unwrap(parseTemplateLiteral(ctxFor(src)));

describe('parseTemplateLiteral', () => {
  test('returns null when the next token is not a template literal', () => {
    expect(parseLit('42')).toBeNull();
  });

  test('parses a plain template with no expressions', () => {
    const node = parseLit('`hello world`') as TemplateLiteralNode;
    expect(getNodeTypeName(node)).toBe('templateLiteral');
    expect(node.quasis).toHaveLength(1);
  });

  test('parses a template with a simple identifier expression', () => {
    const node = parseLit('`hello $' + '{name}`') as TemplateLiteralNode;
    expect(getNodeTypeName(node)).toBe('templateLiteral');
    expect(node.quasis).toHaveLength(2);
    const expr = node.quasis[1];
    expect(expr?.type).toBe('expression');
    expect(getNodeTypeName(expr?.type === 'expression' ? expr.node : undefined)).toBe('symbol');
  });

  test('throws for a complex expression inside the template', () => {
    expect(() => parseLit('`$' + '{a + b}`')).toThrow(/simple identifiers only/);
  });

  test('throws for member-access interpolations like a[0]', () => {
    // WHY: regression — the denylist missed `[`, so `a[0]` parsed into a bogus symbol.
    expect(() => parseLit('`x$' + '{a[0]}y`')).toThrow(/simple identifiers only/);
  });

  test('throws for comma sequences like a,b', () => {
    expect(() => parseLit('`x$' + '{a,b}y`')).toThrow(/simple identifiers only/);
  });

  test('throws for quoted interpolations like "q"', () => {
    expect(() => parseLit('`x$' + '{"q"}y`')).toThrow(/simple identifiers only/);
  });

  test('throws for digit-leading interpolations like 1a', () => {
    expect(() => parseLit('`x$' + '{1a}y`')).toThrow(/simple identifiers only/);
  });

  test('throws for an empty interpolation', () => {
    // WHY: regression — `` `x${}y` `` previously collapsed the empty expression into
    // template text and parsed silently.
    expect(() => parseLit('`x$' + '{}y`')).toThrow(/simple identifiers only/);
  });

  test('accepts dollar and underscore identifiers', () => {
    const node = parseLit('`x$' + '{_v1}y`') as TemplateLiteralNode;
    expect(getNodeTypeName(node)).toBe('templateLiteral');
  });
});
