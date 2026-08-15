import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { isErr } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes';
import type { ParserContext } from '../cursor.ts';
import { nextTokenOrNull } from '../cursor.ts';
import { createParser } from '../index.ts';
import { unwrap } from '../test-helpers.ts';
import { parseExpression } from './expression-parser.ts';

const makeContext = (source: string): ParserContext => {
  const ctx = createParser(createTokenizer(`{{ ${source} }}`));
  nextTokenOrNull(ctx);
  return ctx;
};

const parseExpr = (source: string): Node => unwrap(parseExpression(makeContext(source)));

const rightOf = (node: Node): Node => (node as { right: Node }).right;
const bodyOf = (node: Node): Node => (node as { body: Node }).body;
const condOf = (node: Node): Node => (node as { cond: Node }).cond;
const alternateOf = (node: Node): Node | null => (node as { alternate: Node | null }).alternate;

describe('parseExpression: entry point', () => {
  test('parses a bare literal', () => {
    const literalNode = parseExpr('42');
    expect(getNodeTypeName(literalNode)).toBe('literal');
  });

  test('parses a bare symbol', () => {
    expect(getNodeTypeName(parseExpr('myVar'))).toBe('symbol');
  });

  test('delegates down into arithmetic', () => {
    const addExpression = parseExpr('1 + 2 * 3');
    expect(getNodeTypeName(addExpression)).toBe('add');
    expect(getNodeTypeName(rightOf(addExpression))).toBe('mul');
  });

  test('delegates down into logical operators', () => {
    const orExpression = parseExpr('a or b and c');
    expect(getNodeTypeName(orExpression)).toBe('or');
    expect(getNodeTypeName(rightOf(orExpression))).toBe('and');
  });
});

describe('parseTernaryExpression via parseExpression: inline if/else', () => {
  test('keyword if/else produces an inlineIf with body, cond and alternate', () => {
    const inlineIfNode = parseExpr('a if b else c');
    expect(getNodeTypeName(inlineIfNode)).toBe('inlineIf');
    expect(getNodeTypeName(bodyOf(inlineIfNode))).toBe('symbol');
    expect(getNodeTypeName(condOf(inlineIfNode))).toBe('symbol');
    expect(getNodeTypeName(alternateOf(inlineIfNode) as Node)).toBe('symbol');
  });

  test('keyword if without else sets alternate to null', () => {
    const inlineIfNode = parseExpr('a if b');
    expect(getNodeTypeName(inlineIfNode)).toBe('inlineIf');
    expect(alternateOf(inlineIfNode)).toBeNull();
  });

  test('? : operator form produces an inlineIf with cond, body and alternate', () => {
    const inlineIfNode = parseExpr('a ? b : c');
    expect(getNodeTypeName(inlineIfNode)).toBe('inlineIf');
    expect(getNodeTypeName(condOf(inlineIfNode))).toBe('symbol');
    expect(getNodeTypeName(bodyOf(inlineIfNode))).toBe('symbol');
    expect(getNodeTypeName(alternateOf(inlineIfNode) as Node)).toBe('symbol');
  });

  test('inline if wraps a full arithmetic body and condition', () => {
    const inlineIfNode = parseExpr('1 + 2 if flag else 0');
    expect(getNodeTypeName(inlineIfNode)).toBe('inlineIf');
    expect(getNodeTypeName(bodyOf(inlineIfNode))).toBe('add');
  });
});

describe('parseExpression: walrus and assignment via parseWalrus', () => {
  test('statement-level := produces a variableDeclaration', () => {
    const declNode = parseExpr('x := 1');
    expect(getNodeTypeName(declNode)).toBe('variableDeclaration');
    expect(getNodeTypeName((declNode as { value: Node }).value)).toBe('literal');
  });

  test('compound += produces a compoundAssignment', () => {
    const assignNode = parseExpr('x += 1');
    expect(getNodeTypeName(assignNode)).toBe('compoundAssignment');
    expect((assignNode as { operator: string }).operator).toBe('+=');
  });
});

describe('parseExpression: error handling', () => {
  test('a trailing operator with no operand returns an error result', () => {
    const result = parseExpression(makeContext('1 +'));
    expect(isErr(result)).toBe(true);
  });

  test('an unbalanced parenthesis returns an error result', () => {
    const result = parseExpression(makeContext('(1 + 2'));
    expect(isErr(result)).toBe(true);
  });
});
