import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { createParser } from '../index.ts';
import { parseNodes } from '../parse-root.ts';
import { getNodeTypeName } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { asTokenStream, unwrap } from '../test-helpers.ts';

const parseFirst = (src: string): Node => {
  const ctx = createParser(asTokenStream(createTokenizer(src)));
  return unwrap(parseNodes(ctx))[0] as Node;
};

describe('parseFilterStatement', () => {
  test('parses a filter block as an output wrapping a pipe', () => {
    const node = parseFirst('{% filter upper %}hello{% endfilter %}');
    expect(getNodeTypeName(node)).toBe('output');
    const pipe = (node as { children: readonly Node[] }).children[0] as Node;
    expect(getNodeTypeName(pipe)).toBe('pipe');
  });

  test('supports filter arguments', () => {
    const node = parseFirst('{% filter replace("a", "b") %}x{% endfilter %}');
    expect(getNodeTypeName(node)).toBe('output');
  });

  test('captures the block body as the first pipe argument', () => {
    const node = parseFirst('{% filter upper %}a{{ b }}c{% endfilter %}');
    const pipe = (node as { children: readonly Node[] }).children[0] as Node;
    const args = (pipe as { args: readonly Node[] }).args;
    expect(args.length).toBeGreaterThan(0);
    expect(getNodeTypeName(args[0] as Node)).toBe('capture');
  });
});
