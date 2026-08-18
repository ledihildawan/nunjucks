import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import type { Node } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes';
import { nextTokenOrNull } from '../cursor.ts';
import { createParser } from '../index.ts';
import { unwrap } from '../test-helpers.ts';
import { parseExpression } from './index.ts';

const parse = (src: string): Node => {
  const ctx = createParser(createTokenizer(`{{ ${src} }}`));
  nextTokenOrNull(ctx);
  return unwrap(parseExpression(ctx));
};

const childOf = (n: Node, i = 0): Node => (n as { children: readonly Node[] }).children[i] as Node;
const targetOf = (n: Node): Node => (n as { target: Node }).target;
const valueField = (n: Node): Node => (n as { value: Node }).value;

describe('parsePrimary: literal tokens', () => {
  test.each([
    ['42', 42],
    ['3.14', 3.14],
    ['"double"', 'double'],
    ["'single'", 'single'],
    ['true', true],
    ['false', false],
    ['none', null],
  ])('%s produces a literal carrying the value', (src, expected) => {
    const node = parse(src);
    expect(getNodeTypeName(node)).toBe('literal');
    expect(node.value).toBe(expected);
  });
});

describe('parsePrimary: symbols', () => {
  test('a bare name produces a symbol node', () => {
    const node = parse('userName');
    expect(getNodeTypeName(node)).toBe('symbol');
    expect(node.value).toBe('userName');
  });
});

describe('parsePrimary: aggregates', () => {
  test('an empty array literal has no children', () => {
    const node = parse('[]');
    expect(getNodeTypeName(node)).toBe('array');
    expect((node as { children: readonly Node[] }).children).toHaveLength(0);
  });

  test('an array literal collects element expressions', () => {
    const node = parse('[1, "two"]');
    expect(getNodeTypeName(node)).toBe('array');
    const children = (node as { children: readonly Node[] }).children;
    expect(children).toHaveLength(2);
    expect(children[0] as Node).toHaveProperty('value', 1);
    expect(children[1] as Node).toHaveProperty('value', 'two');
  });

  test('array literals nest', () => {
    const node = parse('[1, [2]]');
    expect(getNodeTypeName(childOf(node, 1))).toBe('array');
    expect(getNodeTypeName(childOf(childOf(node, 1)))).toBe('literal');
  });

  test('an empty dict literal has no children', () => {
    const node = parse('{}');
    expect(getNodeTypeName(node)).toBe('dict');
    expect((node as { children: readonly Node[] }).children).toHaveLength(0);
  });

  test('a dict literal binds keys to values with pair children', () => {
    const node = parse('{a: 1}');
    expect(getNodeTypeName(node)).toBe('dict');
    const pairNode = childOf(node);
    expect(getNodeTypeName(pairNode)).toBe('pair');
    expect(getNodeTypeName((pairNode as { key: Node }).key as Node)).toBe('symbol');
    expect(getNodeTypeName(valueField(pairNode))).toBe('literal');
  });

  test('a dict literal accepts string keys', () => {
    const node = parse('{"k": 1}');
    const pairNode = childOf(node);
    expect((pairNode as { key: Node }).key as Node).toHaveProperty('value', 'k');
  });
});

describe('parsePrimary: parenthesized expressions and template literals', () => {
  test('parentheses wrap the inner expression in a group', () => {
    const node = parse('(1 + 2)');
    expect(getNodeTypeName(node)).toBe('group');
    expect(getNodeTypeName(childOf(node))).toBe('add');
  });

  test('grouping overrides default precedence', () => {
    const node = parse('(1 + 2) * 3');
    expect(getNodeTypeName(node)).toBe('mul');
    expect(getNodeTypeName((node as { left: Node }).left)).toBe('group');
  });

  test('a template literal alternates static and expression quasis', () => {
    // WHY: split like the existing suite — keeps ${...} out of a plain string for lint
    const node = parse('`hi $' + '{name}`');
    expect(getNodeTypeName(node)).toBe('templateLiteral');
    const quasis = (
      node as {
        quasis: readonly (
          | { type: 'template'; value: string }
          | { type: 'expression'; node: Node }
        )[];
      }
    ).quasis;
    expect(quasis).toHaveLength(2);
    expect(quasis[0]).toEqual({ type: 'template', value: 'hi ' });
    expect(quasis[1]?.type).toBe('expression');
    expect(getNodeTypeName((quasis[1] as { node: Node }).node)).toBe('symbol');
  });
});

describe('parseUnary: prefix operators', () => {
  test.each([
    ['-', 'neg'],
    ['+', 'pos'],
  ])('%s produces its unary node with the operator recorded', (operator, expected) => {
    const node = parse(`${operator}a`);
    expect(getNodeTypeName(node)).toBe(expected);
    expect((node as { operator: string }).operator).toBe(operator);
    expect(getNodeTypeName(targetOf(node))).toBe('symbol');
  });

  test('~ produces a bitwiseNot node without an operator field', () => {
    const node = parse('~a');
    expect(getNodeTypeName(node)).toBe('bitwiseNot');
    expect(getNodeTypeName(targetOf(node))).toBe('symbol');
  });

  test.each([
    ['++', 'increment'],
    ['--', 'decrement'],
  ])('prefix %s produces a %s with isPostfix false', (operator, expected) => {
    const node = parse(`${operator}a`);
    expect(getNodeTypeName(node)).toBe(expected);
    expect((node as { isPostfix: boolean }).isPostfix).toBe(false);
    expect(getNodeTypeName(targetOf(node))).toBe('symbol');
  });

  test('a prefix operator applies to the postfix chain of its operand', () => {
    const node = parse('-a.b');
    expect(getNodeTypeName(node)).toBe('neg');
    expect(getNodeTypeName(targetOf(node))).toBe('lookupVal');
  });

  test('prefix operators nest', () => {
    const node = parse('-(-x)');
    expect(getNodeTypeName(node)).toBe('neg');
    expect(getNodeTypeName(targetOf(node))).toBe('group');
    expect(getNodeTypeName(targetOf(childOf(targetOf(node))))).toBe('symbol');
  });

  test('unary minus on a number literal binds tighter than **', () => {
    const node = parse('-2 ** 2');
    expect(getNodeTypeName(node)).toBe('pow');
    expect(getNodeTypeName((node as { left: Node }).left)).toBe('neg');
  });
});

describe('parseUnary: pipe-forward chaining', () => {
  test('value |> filter builds a pipe node with the value as the first argument', () => {
    const node = parse('a |> f');
    expect(getNodeTypeName(node)).toBe('pipe');
    expect(getNodeTypeName((node as { name: Node }).name)).toBe('symbol');
    const args = (node as { args: readonly Node[] }).args;
    expect(getNodeTypeName(args[0] as Node)).toBe('symbol');
    expect((args[0] as Node).value).toBe('a');
  });
});
