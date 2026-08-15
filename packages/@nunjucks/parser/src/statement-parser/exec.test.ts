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

describe('parseExec', () => {
  test('parses an exec with a symbol expression', () => {
    const node = parseFirst('{% exec run %}');
    expect(getNodeTypeName(node)).toBe('exec');
    const expr = (node as { expr: Node }).expr;
    expect(getNodeTypeName(expr)).toBe('symbol');
    expect(expr.value).toBe('run');
  });

  test('parses an exec with a function call', () => {
    const node = parseFirst('{% exec run(1, 2) %}');
    expect(getNodeTypeName(node)).toBe('exec');
    expect(getNodeTypeName((node as { expr: Node }).expr)).toBe('funCall');
  });

  test('parses an exec with a member expression', () => {
    const node = parseFirst('{% exec obj.method() %}');
    expect(getNodeTypeName(node)).toBe('exec');
    expect(getNodeTypeName((node as { expr: Node }).expr)).toBe('funCall');
  });
});
