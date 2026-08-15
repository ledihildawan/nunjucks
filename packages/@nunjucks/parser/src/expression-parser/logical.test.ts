import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { isErr } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes';
import type { ParserContext } from '../cursor.ts';
import { nextTokenOrNull } from '../cursor.ts';
import { createParser } from '../index.ts';
import { unwrap } from '../test-helpers.ts';
import { parseOr, parseTernary } from './logical.ts';

const makeContext = (source: string): ParserContext => {
  const ctx = createParser(createTokenizer(`{{ ${source} }}`));
  nextTokenOrNull(ctx);
  return ctx;
};

const parseOrExpr = (source: string): Node => unwrap(parseOr(makeContext(source)));

const parseTernaryExpr = (source: string): Node => {
  const ctx = makeContext(source);
  const conditionNode = unwrap(parseOr(ctx));
  return unwrap(parseTernary(ctx, conditionNode));
};

const leftOf = (node: Node): Node => (node as { left: Node }).left;
const rightOf = (node: Node): Node => (node as { right: Node }).right;
const targetOf = (node: Node): Node => (node as { target: Node }).target;

describe('parseOr: disjunction', () => {
  test('two operands produce an or node with left and right children', () => {
    const orExpression = parseOrExpr('a or b');
    expect(getNodeTypeName(orExpression)).toBe('or');
    expect(getNodeTypeName(leftOf(orExpression))).toBe('symbol');
    expect(getNodeTypeName(rightOf(orExpression))).toBe('symbol');
  });

  test('|| is an alias for or', () => {
    expect(getNodeTypeName(parseOrExpr('a || b'))).toBe('or');
  });

  test('repeated or folds left-associatively', () => {
    const orExpression = parseOrExpr('a or b or c');
    expect(getNodeTypeName(orExpression)).toBe('or');
    expect(getNodeTypeName(leftOf(orExpression))).toBe('or');
  });
});

describe('parseOr: conjunction via precedence chain', () => {
  test('and produces an and node', () => {
    expect(getNodeTypeName(parseOrExpr('a and b'))).toBe('and');
  });

  test('&& is an alias for and', () => {
    expect(getNodeTypeName(parseOrExpr('a && b'))).toBe('and');
  });

  test('and binds tighter than or', () => {
    const orExpression = parseOrExpr('a or b and c');
    expect(getNodeTypeName(orExpression)).toBe('or');
    expect(getNodeTypeName(rightOf(orExpression))).toBe('and');
  });
});

describe('parseOr: nullish coalescing', () => {
  test('?? produces a nullishCoalesce node', () => {
    const nullishExpression = parseOrExpr('a ?? b');
    expect(getNodeTypeName(nullishExpression)).toBe('nullishCoalesce');
  });

  test('?? binds tighter than or', () => {
    const orExpression = parseOrExpr('a ?? b or c');
    expect(getNodeTypeName(orExpression)).toBe('or');
    expect(getNodeTypeName(leftOf(orExpression))).toBe('nullishCoalesce');
  });
});

describe('parseNot aliases via parseOr chain', () => {
  test('not keyword produces a not node wrapping its operand', () => {
    const notExpression = parseOrExpr('not a');
    expect(getNodeTypeName(notExpression)).toBe('not');
    expect(getNodeTypeName(targetOf(notExpression))).toBe('symbol');
  });

  test('! operator produces a not node', () => {
    expect(getNodeTypeName(parseOrExpr('!a'))).toBe('not');
  });

  test('not binds tighter than and', () => {
    const andExpression = parseOrExpr('not a and b');
    expect(getNodeTypeName(andExpression)).toBe('and');
    expect(getNodeTypeName(leftOf(andExpression))).toBe('not');
  });

  test('not not double-negation nests not nodes', () => {
    const notExpression = parseOrExpr('not not a');
    expect(getNodeTypeName(notExpression)).toBe('not');
    expect(getNodeTypeName(targetOf(notExpression))).toBe('not');
  });

  test('!! operator double-negation nests not nodes', () => {
    const notExpression = parseOrExpr('!!a');
    expect(getNodeTypeName(notExpression)).toBe('not');
    expect(getNodeTypeName(targetOf(notExpression))).toBe('not');
  });
});

describe('parseTernary: ? : operator', () => {
  test('a ? b : c produces an inlineIf with cond, body and alternate', () => {
    const ternaryNode = parseTernaryExpr('a ? b : c');
    expect(getNodeTypeName(ternaryNode)).toBe('inlineIf');
    const inlineIfNode = ternaryNode as { cond: Node; body: Node; alternate: Node };
    expect(getNodeTypeName(inlineIfNode.cond)).toBe('symbol');
    expect(getNodeTypeName(inlineIfNode.body)).toBe('symbol');
    expect(getNodeTypeName(inlineIfNode.alternate)).toBe('symbol');
  });

  test('chained ? : is right-associative', () => {
    const ternaryNode = parseTernaryExpr('a ? b : c ? d : e');
    expect(getNodeTypeName(ternaryNode)).toBe('inlineIf');
    const outer = ternaryNode as { cond: Node; body: Node; alternate: Node };
    expect(getNodeTypeName(outer.cond)).toBe('inlineIf');
  });

  test('without a ? token the original node is returned unchanged', () => {
    const ternaryNode = parseTernaryExpr('justSymbol');
    expect(getNodeTypeName(ternaryNode)).toBe('symbol');
  });
});

describe('parseOr: error handling', () => {
  test('a dangling not with no operand returns an error result', () => {
    const result = parseOr(makeContext('not'));
    expect(isErr(result)).toBe(true);
  });
});
