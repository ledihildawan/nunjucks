import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import type { MatchNode, Node } from '@nunjucks/nodes';
import { getNodeTypeName } from '@nunjucks/nodes';
import { createParser } from '../index.ts';
import { parseNodes } from '../parse-root.ts';
import { unwrap } from '../test-helpers.ts';

const parseFirst = (src: string): Node => {
  const ctx = createParser(createTokenizer(src));
  return unwrap(parseNodes(ctx))[0] as Node;
};

describe('parseMatch', () => {
  test('parses a match with patterns and bodies', () => {
    const node = parseFirst('{% match x %}{% when 1 %}one{% endmatch %}') as MatchNode;
    expect(getNodeTypeName(node)).toBe('match');
    expect(node.cases).toHaveLength(1);
    expect(node.cases[0]?.guard).toBeNull();
  });

  test('parses multiple when branches', () => {
    const node = parseFirst('{% match x %}{% when 1 %}one{% when 2 %}two{% endmatch %}') as MatchNode;
    expect(getNodeTypeName(node)).toBe('match');
    expect(node.cases).toHaveLength(2);
  });

  test('parses when branches with guards', () => {
    const node = parseFirst('{% match x %}{% when 1 if y %}one{% endmatch %}') as MatchNode;
    expect(getNodeTypeName(node)).toBe('match');
    expect(node.cases[0]?.guard).not.toBeNull();
  });

  test('parses a default case via underscore', () => {
    const node = parseFirst('{% match x %}{% when _ %}anything{% endmatch %}') as MatchNode;
    expect(getNodeTypeName(node)).toBe('match');
    expect(node.default).not.toBeNull();
  });

  test('captures the match expression', () => {
    const node = parseFirst('{% match x.y %}{% when 1 %}one{% endmatch %}') as MatchNode;
    expect(getNodeTypeName(node)).toBe('match');
    expect(getNodeTypeName(node.expr)).toBe('lookupVal');
  });
});
