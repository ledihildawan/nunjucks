import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { createParser } from '../index.ts';
import { parseNodes } from '../parse-root.ts';
import { getNodeTypeName, isMatch } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { asTokenStream } from '../test-helpers.ts';

const parseFirst = (src: string): Node => {
  const ctx = createParser(asTokenStream(createTokenizer(src)));
  return parseNodes(ctx)[0] as Node;
};

describe('parseMatch', () => {
  test('parses a match with patterns and bodies', () => {
    const node = parseFirst(
      '{% match x %}{% when 1 %}one{% endmatch %}'
    );
    expect(getNodeTypeName(node)).toBe('match');
    expect(isMatch(node)).toBe(true);
    if (!isMatch(node)) { return; }
    expect(node.cases).toHaveLength(1);
    expect(node.cases[0]?.guard).toBeNull();
  });

  test('parses multiple when branches', () => {
    const node = parseFirst(
      '{% match x %}{% when 1 %}one{% when 2 %}two{% endmatch %}'
    );
    expect(isMatch(node)).toBe(true);
    if (!isMatch(node)) { return; }
    expect(node.cases).toHaveLength(2);
  });

  test('parses when branches with guards', () => {
    const node = parseFirst(
      '{% match x %}{% when 1 if y %}one{% endmatch %}'
    );
    expect(isMatch(node)).toBe(true);
    if (!isMatch(node)) { return; }
    expect(node.cases[0]?.guard).not.toBeNull();
  });

  test('parses a default case via underscore', () => {
    const node = parseFirst(
      '{% match x %}{% when _ %}anything{% endmatch %}'
    );
    expect(isMatch(node)).toBe(true);
    if (!isMatch(node)) { return; }
    expect(node.default).not.toBeNull();
  });

  test('captures the match expression', () => {
    const node = parseFirst(
      '{% match x.y %}{% when 1 %}one{% endmatch %}'
    );
    expect(isMatch(node)).toBe(true);
    if (!isMatch(node)) { return; }
    expect(getNodeTypeName(node.expr)).toBe('lookupVal');
  });
});