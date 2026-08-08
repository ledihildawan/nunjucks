import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { createParser } from '../index.ts';
import { parseNodes } from '../parse-root.ts';
import { getNodeTypeName, isPair } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { asTokenStream, unwrap } from '../test-helpers.ts';

const parseFirst = (src: string): Node => {
  const ctx = createParser(asTokenStream(createTokenizer(src)));
  return unwrap(parseNodes(ctx))[0] as Node;
};

describe('parseScope', () => {
  test('parses a scope without assignments', () => {
    const node = parseFirst('{% scope %}body{% endscope %}');
    expect(getNodeTypeName(node)).toBe('scope');
    expect((node as { assignments: readonly Node[] }).assignments).toHaveLength(0);
  });

  test('parses a scope with a single assignment', () => {
    const node = parseFirst('{% scope x = 1 %}body{% endscope %}');
    expect(getNodeTypeName(node)).toBe('scope');
    const assignments = (node as { assignments: readonly Node[] }).assignments;
    expect(assignments).toHaveLength(1);
    expect(isPair(assignments[0] as Node)).toBe(true);
  });

  test('parses multiple comma-separated assignments', () => {
    const node = parseFirst('{% scope x = 1, y = 2 %}body{% endscope %}');
    const assignments = (node as { assignments: readonly Node[] }).assignments;
    expect(assignments).toHaveLength(2);
  });

  test('captures assignment keys as names', () => {
    const node = parseFirst('{% scope x = 1 %}body{% endscope %}');
    const pairNode = (node as { assignments: readonly Node[] }).assignments[0] as Node;
    expect((pairNode as { key: string }).key).toBe('x');
  });

  test('parses the body', () => {
    const node = parseFirst('{% scope x = 1 %}a{{ b }}{% endscope %}');
    const body = (node as { body: Node }).body;
    expect(getNodeTypeName(body)).toBe('nodeList');
  });
});