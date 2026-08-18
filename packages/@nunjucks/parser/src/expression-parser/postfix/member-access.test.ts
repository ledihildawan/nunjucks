import { describe, expect, test } from 'bun:test';
import type { TemplateError } from '@nunjucks/error-formatter';
import { createTokenizer } from '@nunjucks/lexer';
import { isErr, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes';
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

describe('parseDotAccess: .name member access', () => {
  test('dot access produces a lookupVal with a literal string key', () => {
    const node = parse('obj.name');
    expect(getNodeTypeName(node)).toBe('lookupVal');
    expect(getNodeTypeName((node as { target: Node }).target)).toBe('symbol');
    const key = (node as { val: Node }).val;
    expect(getNodeTypeName(key)).toBe('literal');
    expect(key.value).toBe('name');
  });

  test('dot access chains nest target-first', () => {
    const node = parse('a.b.c');
    expect(getNodeTypeName(node)).toBe('lookupVal');
    expect(((node as { val: Node }).val as Node).value).toBe('c');
    const outerTarget = (node as { target: Node }).target;
    expect(getNodeTypeName(outerTarget)).toBe('lookupVal');
    expect(((outerTarget as { val: Node }).val as Node).value).toBe('b');
  });

  test('a non-symbol after the dot is an error', () => {
    expect(isErr(parseResult('a.'))).toBe(true);
  });
});

describe('parseBracketAccess: [expr] subscript access', () => {
  test('a numeric index becomes the literal key', () => {
    const node = parse('a[0]');
    expect(getNodeTypeName(node)).toBe('lookupVal');
    expect(((node as { val: Node }).val as Node).value).toBe(0);
  });

  test('a string index becomes the literal key', () => {
    const node = parse('a["b"]');
    expect(getNodeTypeName((node as { val: Node }).val)).toBe('literal');
  });

  test('the index parses a full expression', () => {
    const node = parse('a[1 + 2]');
    expect(getNodeTypeName((node as { val: Node }).val)).toBe('add');
  });

  test('a symbol index is kept symbolic', () => {
    const node = parse('a[key]');
    expect(getNodeTypeName((node as { val: Node }).val)).toBe('symbol');
  });

  test('an unclosed bracket is an error', () => {
    expect(isErr(parseResult('a['))).toBe(true);
  });
});

describe('parseBracketAccess: slice subscripts', () => {
  test('a full slice keeps start, stop and step nodes', () => {
    const node = parse('a[1:9:2]');
    const sliceNode = (node as { val: Node }).val as {
      start: Node | null;
      stop: Node | null;
      step: Node | null;
    };
    expect((sliceNode.start as Node).value).toBe(1);
    expect((sliceNode.stop as Node).value).toBe(9);
    expect((sliceNode.step as Node).value).toBe(2);
  });

  test('an omitted start is null while stop is kept', () => {
    const node = parse('a[:3]');
    const sliceNode = (node as { val: Node }).val as {
      start: Node | null;
      stop: Node | null;
      step: Node | null;
    };
    expect(sliceNode.start).toBeNull();
    expect((sliceNode.stop as Node).value).toBe(3);
    expect(sliceNode.step).toBeNull();
  });

  test('an omitted stop is null while start is kept', () => {
    const node = parse('a[1:]');
    const sliceNode = (node as { val: Node }).val as {
      start: Node | null;
      stop: Node | null;
    };
    expect((sliceNode.start as Node).value).toBe(1);
    expect(sliceNode.stop).toBeNull();
  });

  test('an empty slice leaves every bound null', () => {
    const node = parse('a[:]');
    const sliceNode = (node as { val: Node }).val as {
      start: Node | null;
      stop: Node | null;
      step: Node | null;
    };
    expect(sliceNode.start).toBeNull();
    expect(sliceNode.stop).toBeNull();
    expect(sliceNode.step).toBeNull();
  });

  test('a step-only slice keeps only the step bound', () => {
    const node = parse('a[::2]');
    const sliceNode = (node as { val: Node }).val as {
      start: Node | null;
      stop: Node | null;
      step: Node | null;
    };
    expect(sliceNode.start).toBeNull();
    expect(sliceNode.stop).toBeNull();
    expect((sliceNode.step as Node).value).toBe(2);
  });
});

describe('parsePostfix: postfix increment and decrement', () => {
  test.each([
    ['a++', 'increment'],
    ['a--', 'decrement'],
  ])('%s produces a %s with isPostfix true', (src, expected) => {
    const node = parse(src);
    expect(getNodeTypeName(node)).toBe(expected);
    expect((node as { isPostfix: boolean }).isPostfix).toBe(true);
    expect(getNodeTypeName((node as { target: Node }).target)).toBe('symbol');
  });

  test('postfix operators chain off deeper postfix steps', () => {
    const node = parse('a.b++');
    expect(getNodeTypeName(node)).toBe('increment');
    expect(getNodeTypeName((node as { target: Node }).target)).toBe('lookupVal');
  });
});
