import { describe, test, expect } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import { createParser } from '../index.ts';
import { parseNodes } from '../parse-root.ts';
import { getNodeTypeName, isIf } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { asTokenStream } from '../test-helpers.ts';

const parseFirst = (src: string): Node => {
  const ctx = createParser(asTokenStream(createTokenizer(src)));
  return parseNodes(ctx)[0] as Node;
};

describe('parseIf', () => {
  test('parses a minimal if without an else branch', () => {
    const node = parseFirst('{% if cond %}body{% endif %}');
    expect(getNodeTypeName(node)).toBe('if');
    expect(isIf(node)).toBe(true);
    if (!isIf(node)) { return; }
    expect(node.else_).toBeNull();
    expect(node.cond).toBeDefined();
  });

  test('attaches an else body when the else tag is present', () => {
    const node = parseFirst('{% if a %}1{% else %}2{% endif %}');
    expect(getNodeTypeName(node)).toBe('if');
    expect(isIf(node)).toBe(true);
    if (!isIf(node)) { return; }
    const elseBranch = node.else_;
    expect(elseBranch).not.toBeNull();
    expect(getNodeTypeName(elseBranch as Node)).toBe('nodeList');
  });

  test('recurses into a nested if for an elif chain', () => {
    const node = parseFirst('{% if a %}1{% elif b %}2{% endif %}');
    expect(getNodeTypeName(node)).toBe('if');
    expect(isIf(node)).toBe(true);
    if (!isIf(node)) { return; }
    const elifBranch = node.else_;
    expect(getNodeTypeName(elifBranch as Node)).toBe('if');
  });

  test('parses a full if/elif/else chain ending in endif', () => {
    const node = parseFirst('{% if a %}1{% elif b %}2{% else %}3{% endif %}');
    expect(getNodeTypeName(node)).toBe('if');
    expect(isIf(node)).toBe(true);
    if (!isIf(node)) { return; }
    const elifNode = node.else_;
    expect(getNodeTypeName(elifNode as Node)).toBe('if');
    expect(isIf(elifNode)).toBe(true);
    if (!isIf(elifNode)) { return; }
    expect(getNodeTypeName(elifNode.else_ as Node)).toBe('nodeList');
  });

  test('accepts "elseif" as an alias for "elif"', () => {
    const node = parseFirst('{% if a %}1{% elseif b %}2{% endif %}');
    expect(getNodeTypeName(node)).toBe('if');
    expect(isIf(node)).toBe(true);
    if (!isIf(node)) { return; }
    const branch = node.else_;
    expect(getNodeTypeName(branch as Node)).toBe('if');
  });
});