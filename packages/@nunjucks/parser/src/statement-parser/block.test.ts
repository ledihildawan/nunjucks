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

describe('parseBlock', () => {
  test('parses a named block with a body', () => {
    const node = parseFirst('{% block content %}hello{% endblock %}');
    expect(getNodeTypeName(node)).toBe('block');
    expect((node as { name: string }).name).toBe('content');
    expect(getNodeTypeName((node as { body: Node }).body)).toBe('nodeList');
  });

  test('accepts a repeated block name on the end tag', () => {
    const node = parseFirst('{% block content %}hello{% endblock content %}');
    expect(getNodeTypeName(node)).toBe('block');
    expect((node as { name: string }).name).toBe('content');
  });

  test('preserves body children', () => {
    const node = parseFirst('{% block x %}{{ a }}{% endblock %}');
    const body = (node as { body: Node }).body as { children: readonly Node[] };
    expect(body.children).toHaveLength(1);
    expect(getNodeTypeName(body.children[0] as Node)).toBe('output');
  });

  test('accepts an empty block body', () => {
    const node = parseFirst('{% block x %}{% endblock %}');
    expect(getNodeTypeName(node)).toBe('block');
    expect(getNodeTypeName((node as { body: Node }).body)).toBe('nodeList');
  });
});
