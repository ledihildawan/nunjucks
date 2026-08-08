import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { createParser } from '../index.ts';
import { nextTokenOrNull } from '../cursor.ts';
import { parseTemplateLiteral } from './template-literal.ts';
import { getNodeTypeName, isTemplateLiteral } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { asTokenStream, unwrap } from '../test-helpers.ts';

const ctxFor = (src: string) => {
  const tk = createTokenizer(`{{ ${src} }}`);
  const ctx = createParser(asTokenStream(tk));
  nextTokenOrNull(ctx);
  return ctx;
};

const parseLit = (src: string): Node | null => unwrap(parseTemplateLiteral(ctxFor(src)));

describe('parseTemplateLiteral', () => {
  test('returns null when the next token is not a template literal', () => {
    expect(parseLit('42')).toBeNull();
  });

  test('parses a plain template with no expressions', () => {
    const node = parseLit('`hello world`');
    expect(getNodeTypeName(node as Node)).toBe('templateLiteral');
    expect(isTemplateLiteral(node)).toBe(true);
    if (!isTemplateLiteral(node)) { return; }
    expect(node.quasis).toHaveLength(1);
  });

  test('parses a template with a simple identifier expression', () => {
    const node = parseLit('`hello $' + '{name}`');
    expect(getNodeTypeName(node as Node)).toBe('templateLiteral');
    expect(isTemplateLiteral(node)).toBe(true);
    if (!isTemplateLiteral(node)) { return; }
    expect(node.quasis).toHaveLength(2);
    const expr = node.quasis[1];
    expect(expr?.type).toBe('expression');
    expect(getNodeTypeName(expr?.type === 'expression' ? expr.node : undefined)).toBe('symbol');
  });

  test('throws for a complex expression inside the template', () => {
    expect(() => parseLit('`$' + '{a + b}`')).toThrow(/simple identifiers only/);
  });
});