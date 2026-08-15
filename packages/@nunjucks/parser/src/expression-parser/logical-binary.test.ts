import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import type { Node } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes';
import { nextTokenOrNull } from '../cursor.ts';
import { createParser } from '../index.ts';
import { unwrap } from '../test-helpers.ts';
import { parseExpression, parsePrimary } from './index.ts';

const parse = (src: string): Node => {
  const ctx = createParser(createTokenizer(`{{ ${src} }}`));
  nextTokenOrNull(ctx);
  return unwrap(parseExpression(ctx));
};

const parsePrim = (src: string): Node => {
  const ctx = createParser(createTokenizer(`{{ ${src} }}`));
  nextTokenOrNull(ctx);
  return unwrap(parsePrimary(ctx));
};

describe('logical expressions', () => {
  test('and binds tighter than or', () => {
    const node = parse('a or b and c');
    expect(getNodeTypeName(node)).toBe('or');
    const right = (node as { right: Node }).right;
    expect(getNodeTypeName(right)).toBe('and');
  });

  test('not applies to its operand only', () => {
    const node = parse('not a and b');
    expect(getNodeTypeName(node)).toBe('and');
    const left = (node as { left: Node }).left;
    expect(getNodeTypeName(left)).toBe('not');
  });
});

describe('binary shapes', () => {
  test('arithmetic precedence nests mul inside add', () => {
    const node = parse('1 + 2 * 3');
    expect(getNodeTypeName(node)).toBe('add');
    const right = (node as { right: Node }).right;
    expect(getNodeTypeName(right)).toBe('mul');
  });

  test('left associativity of subtraction', () => {
    const node = parse('10 - 4 - 3');
    expect(getNodeTypeName(node)).toBe('sub');
    const left = (node as { left: Node }).left;
    expect(getNodeTypeName(left)).toBe('sub');
  });

  test('power is left associative', () => {
    const node = parse('2 ** 3 ** 2');
    expect(getNodeTypeName(node)).toBe('pow');
    const left = (node as { left: Node }).left;
    expect(getNodeTypeName(left)).toBe('pow');
  });

  test('unary neg binds tighter than binary ops', () => {
    const node = parse('-a + b');
    expect(getNodeTypeName(node)).toBe('add');
    const left = (node as { left: Node }).left;
    expect(getNodeTypeName(left)).toBe('neg');
  });
});

describe('comparison operators', () => {
  test('captures the operator string', () => {
    const node = parse('a >= b') as { ops: readonly Node[] };
    const op = node.ops[0] as { operator: string };
    expect(op.operator).toBe('>=');
  });

  test('chained comparisons collect multiple operands', () => {
    const node = parse('a < b < c') as { ops: readonly Node[] };
    expect(node.ops).toHaveLength(2);
  });

  test('in operator produces an IN node', () => {
    expect(getNodeTypeName(parse('x in arr'))).toBe('in');
  });

  test('not in produces a negated IN node', () => {
    const node = parse('x not in arr');
    expect(getNodeTypeName(node)).toBe('not');
    const inner = (node as { target: Node }).target;
    expect(getNodeTypeName(inner)).toBe('in');
  });
});

describe('test expressions', () => {
  test('is with args produces a testCall', () => {
    expect(getNodeTypeName(parse('x is sameas(1)'))).toBe('testCall');
  });

  test('is without args produces a test node', () => {
    expect(getNodeTypeName(parse('x is defined'))).toBe('test');
  });

  test('is not produces a negation', () => {
    const node = parse('x is not defined');
    expect(getNodeTypeName(node)).toBe('not');
  });
});

describe('ternary / inline if', () => {
  test('ternary produces an inlineIf', () => {
    const node = parse('a ? b : c');
    expect(getNodeTypeName(node)).toBe('inlineIf');
  });

  test('keyword form if/else produces an inlineIf', () => {
    const node = parse('a if b else c');
    expect(getNodeTypeName(node)).toBe('inlineIf');
  });
});

describe('primary expressions', () => {
  test('string with escapes is kept literally', () => {
    const node = parsePrim('"a\\nb"');
    expect(getNodeTypeName(node)).toBe('literal');
    expect(node.value).toBe('a\\nb');
  });

  test('none keyword', () => {
    const node = parsePrim('none');
    expect(getNodeTypeName(node)).toBe('literal');
    expect(node.value).toBeNull();
  });

  test('dict with keys and values', () => {
    const node = parsePrim('{a: 1, b: 2}') as { children: readonly Node[] };
    expect(getNodeTypeName(node)).toBe('dict');
    expect(node.children).toHaveLength(2);
  });

  test('template literal', () => {
    const node = parsePrim('`hello $' + '{name}`');
    expect(getNodeTypeName(node)).toBe('templateLiteral');
  });
});
