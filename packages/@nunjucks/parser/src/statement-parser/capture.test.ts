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

describe('parseCapture', () => {
  test('parses a capture with a variable name', () => {
    const node = parseFirst('{% capture var %}hello{% endcapture %}');
    expect(getNodeTypeName(node)).toBe('capture');
    expect((node as { name: string | null }).name).toBe('var');
    expect(getNodeTypeName((node as { body: Node }).body)).toBe('nodeList');
  });

  test('keeps the body content', () => {
    const node = parseFirst('{% capture x %}a{{ y }}b{% endcapture %}');
    const body = (node as { body: Node }).body as { children: readonly Node[] };
    expect(body.children.length).toBeGreaterThan(1);
  });
});
