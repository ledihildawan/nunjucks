import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { isErr } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { add, getNodeTypeName, mul } from '@nunjucks/nodes';
import type { ParserContext } from '../cursor.ts';
import { nextTokenOrNull, peekToken } from '../cursor.ts';
import { createParser } from '../index.ts';
import { unwrap } from '../test-helpers.ts';
import { binaryOp, op } from './binary-helpers.ts';
import { parseUnary } from './primary.ts';

const makeContext = (source: string): ParserContext => {
  const ctx = createParser(createTokenizer(`{{ ${source} }}`));
  nextTokenOrNull(ctx);
  return ctx;
};

const leftOf = (node: Node): Node => (node as { left: Node }).left;
const rightOf = (node: Node): Node => (node as { right: Node }).right;

describe('op: operator predicate', () => {
  test('matches and consumes the named operator', () => {
    const ctx = makeContext('+');
    expect(op('+')(ctx)).toBe(true);
  });

  test('does not match a different operator and leaves it unconsumed', () => {
    const ctx = makeContext('-');
    expect(op('+')(ctx)).toBe(false);
    expect(unwrap(peekToken(ctx)).value).toBe('-');
  });

  test('returns false when the next token is not the operator', () => {
    const ctx = makeContext('1');
    expect(op('*')(ctx)).toBe(false);
  });
});

describe('binaryOp: single operand', () => {
  test('returns the only operand unchanged when no operator follows', () => {
    const result = binaryOp(makeContext('42'), { create: add, consume: op('+'), next: parseUnary });
    const node = unwrap(result);
    expect(getNodeTypeName(node)).toBe('literal');
  });
});

describe('binaryOp: folding', () => {
  test('two operands build a binary node using the supplied factory', () => {
    const result = binaryOp(makeContext('1 + 2'), {
      create: add,
      consume: op('+'),
      next: parseUnary,
    });
    const addNode = unwrap(result);
    expect(getNodeTypeName(addNode)).toBe('add');
    expect((addNode as { operator: string }).operator).toBe('+');
    expect(getNodeTypeName(leftOf(addNode))).toBe('literal');
    expect(getNodeTypeName(rightOf(addNode))).toBe('literal');
  });

  test('folds left-associatively across three operands', () => {
    const result = binaryOp(makeContext('1 + 2 + 3'), {
      create: add,
      consume: op('+'),
      next: parseUnary,
    });
    const outer = unwrap(result);
    expect(getNodeTypeName(outer)).toBe('add');
    expect(getNodeTypeName(leftOf(outer))).toBe('add');
    expect(getNodeTypeName(rightOf(outer))).toBe('literal');
  });

  test('is generic over the node factory', () => {
    const result = binaryOp(makeContext('2 * 3'), {
      create: mul,
      consume: op('*'),
      next: parseUnary,
    });
    expect(getNodeTypeName(unwrap(result))).toBe('mul');
  });

  test('carries a location taken from the operator token', () => {
    const result = binaryOp(makeContext('1 + 2'), {
      create: add,
      consume: op('+'),
      next: parseUnary,
    });
    const addNode = unwrap(result) as { lineno: number; colno: number };
    expect(Number.isInteger(addNode.lineno)).toBe(true);
    expect(Number.isInteger(addNode.colno)).toBe(true);
  });
});

describe('binaryOp: error propagation', () => {
  test('a missing right operand surfaces an error result', () => {
    const result = binaryOp(makeContext('1 +'), {
      create: add,
      consume: op('+'),
      next: parseUnary,
    });
    expect(isErr(result)).toBe(true);
  });
});
