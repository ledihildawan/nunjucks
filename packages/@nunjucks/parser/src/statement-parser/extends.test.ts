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

describe('parseExtends', () => {
  test('parses an extends with a literal template', () => {
    const node = parseFirst('{% extends "base.html" %}');
    expect(getNodeTypeName(node)).toBe('extends');
    expect((node as { template: Node }).template.value).toBe('base.html');
  });

  test('parses an extends with an expression template', () => {
    const node = parseFirst('{% extends base %}');
    expect(getNodeTypeName(node)).toBe('extends');
    expect(getNodeTypeName((node as { template: Node }).template)).toBe('symbol');
  });

  test('builds the node with the template field in a single factory call (no mutation)', () => {
    const node = parseFirst('{% extends "base.html" %}') as { template: Node };
    expect(node.template).toBeDefined();
    expect(getNodeTypeName(node.template)).toBe('literal');
    expect(node.template.value).toBe('base.html');
  });
});
