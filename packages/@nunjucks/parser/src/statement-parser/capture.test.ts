import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { createParser } from '../index.ts';
import { parseNodes } from '../parse-root.ts';
import { getNodeTypeName } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { asTokenStream } from '../test-helpers.ts';

const parseFirst = (src: string): Node => {
  const ctx = createParser(asTokenStream(createTokenizer(src)));
  return parseNodes(ctx)[0] as Node;
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
