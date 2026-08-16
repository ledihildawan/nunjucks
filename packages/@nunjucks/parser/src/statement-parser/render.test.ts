import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import type { Node, RenderNode } from '@nunjucks/nodes';
import { getNodeTypeName, isFunCall } from '@nunjucks/nodes';
import { createParser } from '../index.ts';
import { parseNodes } from '../parse-root.ts';
import { unwrap } from '../test-helpers.ts';

const parseFirst = (src: string): Node => {
  const ctx = createParser(createTokenizer(src));
  return unwrap(parseNodes(ctx))[0] as Node;
};

describe('parseRenderBlock', () => {
  test('parses a render with a call expression', () => {
    const node = parseFirst('{% render card() %}body{% endrender %}') as RenderNode;
    expect(getNodeTypeName(node)).toBe('render');
    expect(isFunCall(node.callExpr)).toBe(true);
  });

  test('wraps a bare symbol into a funCall', () => {
    const node = parseFirst('{% render card %}body{% endrender %}') as RenderNode;
    expect(getNodeTypeName(node)).toBe('render');
    expect(isFunCall(node.callExpr)).toBe(true);
  });

  test('exposes default body content', () => {
    const node = parseFirst('{% render card() %}hello{% endrender %}') as RenderNode;
    expect(getNodeTypeName(node)).toBe('render');
    expect(getNodeTypeName(node.body)).toBe('nodeList');
  });

  test('collects provided slots', () => {
    const node = parseFirst(
      '{% render card() %}{% slot header %}head{% endslot %}body{% endrender %}'
    ) as RenderNode;
    expect(getNodeTypeName(node)).toBe('render');
    expect(node.providedSlots.some((s) => s.name === 'header')).toBe(true);
  });
});
