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

describe('postfix: function calls', () => {
  test('funCall keeps target and args', () => {
    const node = parse('greet("a", 2)');
    expect(getNodeTypeName(node)).toBe('funCall');
    const args = (node as { args: readonly Node[] }).args;
    expect(args).toHaveLength(2);
  });

  test('empty parens produce zero args', () => {
    const node = parse('fn()');
    expect(getNodeTypeName(node)).toBe('funCall');
    expect((node as { args: readonly Node[] }).args).toHaveLength(0);
  });

  test('chained calls nest', () => {
    const node = parse('a.b(1)(2)');
    expect(getNodeTypeName(node)).toBe('funCall');
    const outer = (node as { name: Node }).name;
    expect(getNodeTypeName(outer)).toBe('funCall');
  });
});

describe('postfix: dot access', () => {
  test('creates a lookupVal with a literal key', () => {
    const node = parse('obj.name');
    expect(getNodeTypeName(node)).toBe('lookupVal');
    const key = (node as { val: Node }).val;
    expect(getNodeTypeName(key)).toBe('literal');
    expect(key.value).toBe('name');
  });

  test('chains lookups', () => {
    const node = parse('a.b.c');
    expect(getNodeTypeName(node)).toBe('lookupVal');
    expect(getNodeTypeName((node as { target: Node }).target)).toBe('lookupVal');
  });
});

describe('postfix: bracket access', () => {
  test('bracket access uses the expression as key', () => {
    const node = parse('a[0]');
    expect(getNodeTypeName(node)).toBe('lookupVal');
    const key = (node as { val: Node }).val;
    expect(getNodeTypeName(key)).toBe('literal');
    expect(key.value).toBe(0);
  });

  test('bracket access with a string key', () => {
    const node = parse('a["b"]');
    expect(getNodeTypeName((node as { val: Node }).val)).toBe('literal');
  });

  test('slice with start and stop', () => {
    const node = parse('a[1:3]');
    expect(getNodeTypeName(node)).toBe('lookupVal');
    const sliceNode = (node as { val: Node }).val;
    expect(getNodeTypeName(sliceNode)).toBe('slice');
    const slice = sliceNode as { start: Node; stop: Node; step: Node };
    expect(slice.start).toBeDefined();
    expect(slice.stop).toBeDefined();
    expect(slice.step).toBeNull();
  });

  test('slice with start, stop and step', () => {
    const node = parse('a[1:9:2]');
    const sliceNode = (node as { val: Node }).val as { start: Node; stop: Node; step: Node };
    expect(sliceNode.start).toBeDefined();
    expect(sliceNode.stop).toBeDefined();
    expect(sliceNode.step).toBeDefined();
  });

  test('slice without start', () => {
    const node = parse('a[:3]');
    const sliceNode = (node as { val: Node }).val as { start: Node; stop: Node; step: Node };
    expect(sliceNode.start).toBeNull();
    expect(sliceNode.stop).toBeDefined();
  });
});

describe('postfix: optional chaining', () => {
  test('optional member access', () => {
    const node = parse('a?.b');
    expect(getNodeTypeName(node)).toBe('optionalChain');
    const key = (node as { val: Node }).val;
    expect(getNodeTypeName(key)).toBe('literal');
    expect(key.value).toBe('b');
  });

  test('optional call', () => {
    const node = parse('a?.()');
    expect(getNodeTypeName(node)).toBe('optionalCall');
  });

  test('optional call with args', () => {
    const node = parse('a?.(1, 2)');
    expect(getNodeTypeName(node)).toBe('optionalCall');
    const args = (node as { args: readonly Node[] }).args;
    expect(args).toHaveLength(2);
  });

  test('optional bracket access', () => {
    const node = parse('a?.[0]');
    expect(getNodeTypeName(node)).toBe('optionalChain');
  });
});

describe('postfix: increment / decrement', () => {
  test('postfix increment', () => {
    const node = parse('a++');
    expect(getNodeTypeName(node)).toBe('increment');
    expect((node as { isPostfix: boolean }).isPostfix).toBe(true);
  });

  test('postfix decrement', () => {
    const node = parse('a--');
    expect(getNodeTypeName(node)).toBe('decrement');
    expect((node as { isPostfix: boolean }).isPostfix).toBe(true);
  });
});

describe('walrus assignment', () => {
  test(':= at statement level becomes a variableDeclaration', () => {
    const node = parse('x := 1');
    expect(getNodeTypeName(node)).toBe('variableDeclaration');
    expect((node as { value: Node }).value).toBeDefined();
  });

  test(':= inside parentheses becomes a walrus', () => {
    const node = parse('(x := 1)');
    expect(getNodeTypeName(node)).toBe('group');
    const inner = childOf(node);
    expect(getNodeTypeName(inner)).toBe('walrus');
  });

  test('walrus keeps the value', () => {
    const node = parse('(x := 1)');
    const walrus = childOf(node) as { value: Node };
    expect(getNodeTypeName(walrus.value)).toBe('literal');
  });
});

describe('nested expression shapes', () => {
  test('lookupVal val field carries the accessed key', () => {
    const node = parse('user.profile.name');
    expect(getNodeTypeName(node)).toBe('lookupVal');
    expect((node as { val: Node }).val.value).toBe('name');
  });

  test('funCall args parse into the args field', () => {
    const node = parse('fn(a.b)');
    expect(getNodeTypeName((node as { name: Node }).name)).toBe('symbol');
    const args = (node as { args: readonly Node[] }).args;
    expect(args).toHaveLength(1);
    expect(getNodeTypeName(args[0] as Node)).toBe('lookupVal');
  });

  test('array literal elements parse to children', () => {
    const node = parse('[1, 2]');
    expect(getNodeTypeName(node)).toBe('array');
    expect((node as { children: readonly Node[] }).children).toHaveLength(2);
  });
});
