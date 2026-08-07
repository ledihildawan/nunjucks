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
});