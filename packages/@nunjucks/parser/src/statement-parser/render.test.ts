import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import type { Node } from '@nunjucks/nodes';
import { getNodeTypeName, isFunCall, isRender } from '@nunjucks/nodes';
import { createParser } from '../index.ts';
import { parseNodes } from '../parse-root.ts';
import { unwrap } from '../test-helpers.ts';

const parseFirst = (src: string): Node => {
  const ctx = createParser(createTokenizer(src));
  return unwrap(parseNodes(ctx))[0] as Node;
};

describe('parseRenderBlock', () => {
  test('parses a render with a call expression', () => {
    const node = parseFirst('{% render card() %}body{% endrender %}');
    expect(getNodeTypeName(node)).toBe('render');
    expect(isRender(node)).toBe(true);
    if (!isRender(node)) {
      return;
    }
    expect(isFunCall(node.callExpr)).toBe(true);
  });

  test('wraps a bare symbol into a funCall', () => {
    const node = parseFirst('{% render card %}body{% endrender %}');
    expect(isRender(node)).toBe(true);
    if (!isRender(node)) {
      return;
    }
    expect(isFunCall(node.callExpr)).toBe(true);
  });

  test('exposes default body content', () => {
    const node = parseFirst('{% render card() %}hello{% endrender %}');
    expect(isRender(node)).toBe(true);
    if (!isRender(node)) {
      return;
    }
    expect(getNodeTypeName(node.body)).toBe('nodeList');
  });

  test('collects provided slots', () => {
    const node = parseFirst(
      '{% render card() %}{% slot header %}head{% endslot %}body{% endrender %}'
    );
    expect(isRender(node)).toBe(true);
    if (!isRender(node)) {
      return;
    }
    expect(node.providedSlots.some((s) => s.name === 'header')).toBe(true);
  });
});
