import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { createParser } from '../index.ts';
import { parseNodes } from '../parse-root.ts';
import { getNodeTypeName, isArray, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { asTokenStream, unwrap } from '../test-helpers.ts';

const parseFirst = (src: string): Node => {
  const ctx = createParser(asTokenStream(createTokenizer(src)));
  return unwrap(parseNodes(ctx))[0] as Node;
};

describe('parseFor', () => {
  test('parses a minimal for loop with a symbol target', () => {
    const node = parseFirst('{% for i in items %}x{% endfor %}');
    expect(getNodeTypeName(node)).toBe('for');
    const name = (node as { name: Node }).name;
    expect(isSymbol(name)).toBe(true);
    expect(name.value).toBe('i');
    expect(getNodeTypeName((node as { arr: Node }).arr)).toBe('symbol');
  });

  test('parses a for loop with an else branch', () => {
    const node = parseFirst('{% for i in items %}x{% else %}empty{% endfor %}');
    expect(getNodeTypeName(node)).toBe('for');
    const elseBranch = (node as { alternate: Node | null }).alternate;
    expect(elseBranch).not.toBeNull();
    expect(getNodeTypeName(elseBranch as Node)).toBe('nodeList');
  });

  test('parses destructuring targets as array patterns', () => {
    const node = parseFirst('{% for a, b in pairs %}x{% endfor %}');
    expect(getNodeTypeName(node)).toBe('for');
    const name = (node as { name: Node }).name;
    expect(getNodeTypeName(name)).toBe('array');
    expect((name as { children: readonly Node[] }).children).toHaveLength(2);
  });

  test('parses an array literal as the iterable', () => {
    const node = parseFirst('{% for i in [1, 2, 3] %}x{% endfor %}');
    expect(getNodeTypeName(node)).toBe('for');
    const arr = (node as { arr: Node }).arr;
    expect(getNodeTypeName(arr)).toBe('array');
    expect(isArray(arr)).toBe(true);
    expect((arr as { children: readonly Node[] }).children).toHaveLength(3);
  });

  test('parses the loop body as a nodeList', () => {
    const node = parseFirst('{% for i in items %}a{{ i }}b{% endfor %}');
    expect(getNodeTypeName(node)).toBe('for');
    const body = (node as { body: Node }).body;
    expect(getNodeTypeName(body)).toBe('nodeList');
    expect((body as { children: readonly Node[] }).children.length).toBeGreaterThan(1);
  });
});
