import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import type { Node } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes';
import { createParser } from '../index.ts';
import { parseNodes } from '../parse-root.ts';
import { unwrap } from '../test-helpers.ts';

const parseFirst = (src: string): Node => {
  const ctx = createParser(createTokenizer(src));
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

  test('parses a fully-specified include with only and ignore missing together', () => {
    const node = parseFirst('{% include "partial.html" only ignore missing %}') as {
      template: Node;
      ignoreMissing: boolean | null;
      only?: boolean;
      with?: Node;
    };
    expect(node.template.value).toBe('partial.html');
    expect(node.only).toBe(true);
    expect(node.ignoreMissing).toBe(true);
    expect(node.with).toBeUndefined();
  });

  test('builds the node with default ignoreMissing=null when not specified', () => {
    const node = parseFirst('{% include "partial.html" %}') as {
      ignoreMissing: boolean | null;
      only?: boolean;
      with?: Node;
    };
    expect(node.ignoreMissing).toBeNull();
    expect(node.only).toBeUndefined();
    expect(node.with).toBeUndefined();
  });
});
