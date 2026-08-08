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

describe('parseInclude', () => {
  test('parses a minimal include', () => {
    const node = parseFirst('{% include "partial.html" %}');
    expect(getNodeTypeName(node)).toBe('include');
    expect((node as { template: Node }).template.value).toBe('partial.html');
  });

  test('parses ignore missing flag', () => {
    const node = parseFirst('{% include "partial.html" ignore missing %}');
    expect((node as { ignoreMissing: boolean }).ignoreMissing).toBe(true);
  });

  test('parses only flag', () => {
    const node = parseFirst('{% include "partial.html" only %}');
    expect((node as { only: boolean }).only).toBe(true);
  });

  test('parses with an expression context', () => {
    const node = parseFirst('{% include "partial.html" with user %}');
    expect((node as { with: Node }).with).toBeDefined();
  });
});