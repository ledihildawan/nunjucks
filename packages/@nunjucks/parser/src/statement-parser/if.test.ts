import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import type { Node } from '@nunjucks/nodes';
import { getNodeTypeName, isIf } from '@nunjucks/nodes';
import { createParser } from '../index.ts';
import { parseNodes } from '../parse-root.ts';
import { unwrap } from '../test-helpers.ts';

const parseFirst = (src: string): Node => {
  const ctx = createParser(createTokenizer(src));
  return unwrap(parseNodes(ctx))[0] as Node;
};

describe('parseIf', () => {
  test('parses a minimal if without an else branch', () => {
    const node = parseFirst('{% if cond %}body{% endif %}');
    expect(getNodeTypeName(node)).toBe('if');
    expect(isIf(node)).toBe(true);
    if (!isIf(node)) {
      return;
    }
    expect(node.alternate).toBeNull();
    expect(node.cond).toBeDefined();
  });

  test('attaches an else body when the else tag is present', () => {
    const node = parseFirst('{% if a %}1{% else %}2{% endif %}');
    expect(getNodeTypeName(node)).toBe('if');
    expect(isIf(node)).toBe(true);
    if (!isIf(node)) {
      return;
    }
    const elseBranch = node.alternate;
    expect(elseBranch).not.toBeNull();
    expect(getNodeTypeName(elseBranch as Node)).toBe('nodeList');
  });

  test('recurses into a nested if for an elif chain', () => {
    const node = parseFirst('{% if a %}1{% elif b %}2{% endif %}');
    expect(getNodeTypeName(node)).toBe('if');
    expect(isIf(node)).toBe(true);
    if (!isIf(node)) {
      return;
    }
    const elifBranch = node.alternate;
    expect(getNodeTypeName(elifBranch as Node)).toBe('if');
  });

  test('parses a full if/elif/else chain ending in endif', () => {
    const node = parseFirst('{% if a %}1{% elif b %}2{% else %}3{% endif %}');
    expect(getNodeTypeName(node)).toBe('if');
    expect(isIf(node)).toBe(true);
    if (!isIf(node)) {
      return;
    }
    const elifNode = node.alternate;
    expect(getNodeTypeName(elifNode as Node)).toBe('if');
    expect(isIf(elifNode)).toBe(true);
    if (!isIf(elifNode)) {
      return;
    }
    expect(getNodeTypeName(elifNode.alternate as Node)).toBe('nodeList');
  });

  test('accepts "elseif" as an alias for "elif"', () => {
    const node = parseFirst('{% if a %}1{% elseif b %}2{% endif %}');
    expect(getNodeTypeName(node)).toBe('if');
    expect(isIf(node)).toBe(true);
    if (!isIf(node)) {
      return;
    }
    const branch = node.alternate;
    expect(getNodeTypeName(branch as Node)).toBe('if');
  });
});
