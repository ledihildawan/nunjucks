import { describe, expect, test } from 'bun:test';
import type { TemplateError } from '@nunjucks/error-formatter';
import { createTokenizer } from '@nunjucks/lexer';
import { isErr, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { BracketNotation, getNodeTypeName } from '@nunjucks/nodes';
import { nextTokenOrNull } from '../../cursor.ts';
import { createParser } from '../../index.ts';
import { unwrap } from '../../test-helpers.ts';
import { parseExpression } from '../index.ts';

const parse = (src: string): Node => {
  const ctx = createParser(createTokenizer(`{{ ${src} }}`));
  nextTokenOrNull(ctx);
  return unwrap(parseExpression(ctx));
};

const parseResult = (src: string): Result<Node, TemplateError> => {
  const ctx = createParser(createTokenizer(`{{ ${src} }}`));
  nextTokenOrNull(ctx);
  return parseExpression(ctx);
};

const argsOf = (n: Node): readonly Node[] => (n as { args: readonly Node[] }).args;

describe('parseFunCall: call signatures', () => {
  test('a call keeps its callee and positional arguments', () => {
    const node = parse('greet("a", 2)');
    expect(getNodeTypeName(node)).toBe('funCall');
    expect(getNodeTypeName((node as { name: Node }).name)).toBe('symbol');
    const args = argsOf(node);
    expect(args).toHaveLength(2);
    expect((args[0] as Node).value).toBe('a');
    expect((args[1] as Node).value).toBe(2);
  });

  test('empty parens produce zero arguments', () => {
    expect(argsOf(parse('fn()'))).toHaveLength(0);
  });

  test('keyword arguments collect into a trailing keywordArgs node of pairs', () => {
    const node = parse('f(1, k=2)');
    const args = argsOf(node);
    expect(args).toHaveLength(2);
    const kwargs = args[1] as Node;
    expect(getNodeTypeName(kwargs)).toBe('keywordArgs');
    const pairNode = (kwargs as { children: readonly Node[] }).children[0] as Node;
    expect(getNodeTypeName(pairNode)).toBe('pair');
    expect((pairNode as { key: Node }).key as Node).toHaveProperty('value', 'k');
    expect((pairNode as { value: Node }).value as Node).toHaveProperty('value', 2);
  });

  test('a keyword-only call still wraps kwargs in the argument list', () => {
    const node = parse('f(a=1)');
    const args = argsOf(node);
    expect(args).toHaveLength(1);
    expect(getNodeTypeName(args[0] as Node)).toBe('keywordArgs');
  });

  test('a parenthesized callee is kept as a group name', () => {
    const node = parse('(f)(1)');
    expect(getNodeTypeName(node)).toBe('funCall');
    expect(getNodeTypeName((node as { name: Node }).name)).toBe('group');
    expect(argsOf(node)).toHaveLength(1);
  });

  test('calls chain left-to-right on the previous result', () => {
    const node = parse('a.b(1)(2)');
    expect(getNodeTypeName(node)).toBe('funCall');
    const inner = (node as { name: Node }).name;
    expect(getNodeTypeName(inner)).toBe('funCall');
    expect(getNodeTypeName((inner as { name: Node }).name)).toBe('lookupVal');
    expect(argsOf(node)).toHaveLength(1);
  });
});

describe('parseOptionalChain: ?. segments', () => {
  test('?.name produces an optionalChain with a literal key', () => {
    const node = parse('a?.b');
    expect(getNodeTypeName(node)).toBe('optionalChain');
    expect(getNodeTypeName((node as { target: Node }).target)).toBe('symbol');
    expect(((node as { val: Node }).val as Node).value).toBe('b');
  });

  test('?.() produces an optionalCall with no arguments', () => {
    const node = parse('a?.()');
    expect(getNodeTypeName(node)).toBe('optionalCall');
    expect(argsOf(node)).toHaveLength(0);
  });

  test('?.(args...) forwards the arguments to the optionalCall', () => {
    const node = parse('a?.(1, 2)');
    expect(getNodeTypeName(node)).toBe('optionalCall');
    expect(argsOf(node)).toHaveLength(2);
  });

  test('?.[expr] produces an optionalChain keyed by the expression', () => {
    const node = parse('a?.[0]');
    expect(getNodeTypeName(node)).toBe('optionalChain');
    expect(((node as { val: Node }).val as Node).value).toBe(0);
  });

  test('?. mixes into longer postfix chains', () => {
    const node = parse('a.b(1)[2]?.d');
    expect(getNodeTypeName(node)).toBe('optionalChain');
    expect(((node as { val: Node }).val as Node).value).toBe('d');
    expect(getNodeTypeName((node as { target: Node }).target)).toBe('lookupVal');
  });

  test('a call after an optional member access is a plain funCall on the chain', () => {
    const node = parse('a?.b(1)');
    expect(getNodeTypeName(node)).toBe('funCall');
    expect(getNodeTypeName((node as { name: Node }).name)).toBe('optionalChain');
    expect(argsOf(node)).toHaveLength(1);
  });

  test('a non-symbol after ?. is an error', () => {
    expect(isErr(parseResult('a?.'))).toBe(true);
  });
});

describe('parsePipeForward: |> pipe-forward filters', () => {
  test('a bare filter name is kept symbolic', () => {
    const node = parse('a |> upper');
    expect(getNodeTypeName(node)).toBe('pipe');
    expect(((node as { name: Node }).name as Node).value).toBe('upper');
    expect(argsOf(node)).toHaveLength(1);
  });

  test('filter arguments append after the piped value', () => {
    const node = parse('a |> f(1, 2)');
    expect(getNodeTypeName(node)).toBe('pipe');
    const args = argsOf(node);
    expect(args).toHaveLength(3);
    expect((args[1] as Node).value).toBe(1);
    expect((args[2] as Node).value).toBe(2);
  });

  test('dotted filter names fold into one symbol', () => {
    const node = parse('a |> ns.sub.filter(1)');
    expect(((node as { name: Node }).name as Node).value).toBe('ns.sub.filter');
    expect(argsOf(node)).toHaveLength(2);
  });

  test('consecutive pipes nest left-to-right', () => {
    const node = parse('a |> f |> g');
    expect(getNodeTypeName(node)).toBe('pipe');
    const inner = argsOf(node)[0] as Node;
    expect(getNodeTypeName(inner)).toBe('pipe');
    expect(((node as { name: Node }).name as Node).value).toBe('g');
  });

  test('a dangling |> with no filter name is an error', () => {
    expect(isErr(parseResult('a |> '))).toBe(true);
  });
});

describe('postfix loop: bracket/dot notation marks', () => {
  test('dot access marks the lookup as non-bracket notation', () => {
    const node = parse('a.b');
    expect(node[BracketNotation]).toBe(false);
  });

  test('bracket access marks the lookup as bracket notation', () => {
    const node = parse('a["b"]');
    expect(node[BracketNotation]).toBe(true);
  });

  test('optional member access carries the dot mark', () => {
    const node = parse('a?.b');
    expect(node[BracketNotation]).toBe(false);
  });

  test('optional bracket access carries the bracket mark', () => {
    const node = parse('a?.[0]');
    expect(node[BracketNotation]).toBe(true);
  });
});
