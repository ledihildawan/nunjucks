import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { isErr } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes';
import type { ParserContext } from '../cursor.ts';
import { nextTokenOrNull } from '../cursor.ts';
import { createParser } from '../index.ts';
import { unwrap } from '../test-helpers.ts';
import { parseConcat } from './arithmetic.ts';

const makeContext = (source: string): ParserContext => {
  const ctx = createParser(createTokenizer(`{{ ${source} }}`));
  nextTokenOrNull(ctx);
  return ctx;
};

const parseArithmetic = (source: string): Node => unwrap(parseConcat(makeContext(source)));

const operatorOf = (node: Node): string => (node as { operator: string }).operator;
const leftOf = (node: Node): Node => (node as { left: Node }).left;
const rightOf = (node: Node): Node => (node as { right: Node }).right;

describe('parseConcat: arithmetic operators', () => {
  test('addition produces an add node with the + operator', () => {
    const addExpression = parseArithmetic('1 + 2');
    expect(getNodeTypeName(addExpression)).toBe('add');
    expect(operatorOf(addExpression)).toBe('+');
  });

  test('subtraction produces a sub node with the - operator', () => {
    const subExpression = parseArithmetic('1 - 2');
    expect(getNodeTypeName(subExpression)).toBe('sub');
    expect(operatorOf(subExpression)).toBe('-');
  });

  test('multiplication produces a mul node with the * operator', () => {
    const mulExpression = parseArithmetic('2 * 3');
    expect(getNodeTypeName(mulExpression)).toBe('mul');
    expect(operatorOf(mulExpression)).toBe('*');
  });

  test('division produces a div node with the / operator', () => {
    const divExpression = parseArithmetic('6 / 2');
    expect(getNodeTypeName(divExpression)).toBe('div');
    expect(operatorOf(divExpression)).toBe('/');
  });

  test('floor division produces a floorDiv node with the // operator', () => {
    const floorDivExpression = parseArithmetic('7 // 2');
    expect(getNodeTypeName(floorDivExpression)).toBe('floorDiv');
    expect(operatorOf(floorDivExpression)).toBe('//');
  });

  test('modulo produces a mod node with the % operator', () => {
    const modExpression = parseArithmetic('7 % 3');
    expect(getNodeTypeName(modExpression)).toBe('mod');
    expect(operatorOf(modExpression)).toBe('%');
  });

  test('power produces a pow node with the ** operator', () => {
    const powExpression = parseArithmetic('2 ** 3');
    expect(getNodeTypeName(powExpression)).toBe('pow');
    expect(operatorOf(powExpression)).toBe('**');
  });
});

describe('parseConcat: string concatenation', () => {
  test('tilde produces a concat node', () => {
    const concatExpression = parseArithmetic('"a" ~ "b"');
    expect(getNodeTypeName(concatExpression)).toBe('concat');
    expect(getNodeTypeName(leftOf(concatExpression))).toBe('literal');
    expect(getNodeTypeName(rightOf(concatExpression))).toBe('literal');
  });
});

describe('parseConcat: range', () => {
  test('double-dot produces a range node with left and right bounds', () => {
    const rangeExpression = parseArithmetic('1 .. 5');
    expect(getNodeTypeName(rangeExpression)).toBe('range');
    expect(getNodeTypeName(leftOf(rangeExpression))).toBe('literal');
    expect(getNodeTypeName(rightOf(rangeExpression))).toBe('literal');
  });
});

describe('parseConcat: precedence and associativity', () => {
  test('multiplication binds tighter than addition', () => {
    const addExpression = parseArithmetic('1 + 2 * 3');
    expect(getNodeTypeName(addExpression)).toBe('add');
    expect(getNodeTypeName(rightOf(addExpression))).toBe('mul');
  });

  test('subtraction folds left-associatively', () => {
    const subExpression = parseArithmetic('10 - 4 - 3');
    expect(getNodeTypeName(subExpression)).toBe('sub');
    expect(getNodeTypeName(leftOf(subExpression))).toBe('sub');
  });

  test('range binds looser than addition', () => {
    const rangeExpression = parseArithmetic('1 + 2 .. 5');
    expect(getNodeTypeName(rangeExpression)).toBe('range');
    expect(getNodeTypeName(leftOf(rangeExpression))).toBe('add');
  });

  test('concatenation binds looser than range', () => {
    const concatExpression = parseArithmetic('"x" ~ 1 .. 2');
    expect(getNodeTypeName(concatExpression)).toBe('concat');
    expect(getNodeTypeName(rightOf(concatExpression))).toBe('range');
  });
});

describe('parseConcat: error handling', () => {
  test('a dangling operator with no right operand returns an error result', () => {
    const result = parseConcat(makeContext('1 +'));
    expect(isErr(result)).toBe(true);
  });
});
