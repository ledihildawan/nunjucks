import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '@nunjucks/lexer';
import type { Node } from '@nunjucks/nodes';
import { getNodeTypeName, isPair } from '@nunjucks/nodes';
import { createParser } from '../index.ts';
import { parseNodes } from '../parse-root.ts';
import { unwrap } from '../test-helpers.ts';

const parseFirst = (src: string): Node => {
  const ctx = createParser(createTokenizer(src));
  return unwrap(parseNodes(ctx))[0] as Node;
};

describe('parseFrom', () => {
  test('parses a from-import with a single name', () => {
    const node = parseFirst('{% from "lib.html" import foo %}');
    expect(getNodeTypeName(node)).toBe('fromImport');
    const names = (node as { names: Node }).names;
    expect((names as { children: readonly Node[] }).children).toHaveLength(1);
    expect(getNodeTypeName((names as { children: readonly Node[] }).children[0] as Node)).toBe(
      'symbol'
    );
  });

  test('parses multiple comma-separated names', () => {
    const node = parseFirst('{% from "lib.html" import a, b, c %}');
    const names = (node as { names: Node }).names as { children: readonly Node[] };
    expect(names.children).toHaveLength(3);
  });

  test('supports as-alias pairs', () => {
    const node = parseFirst('{% from "lib.html" import a as b %}');
    const names = (node as { names: Node }).names as { children: readonly Node[] };
    const first = names.children[0] as Node;
    expect(isPair(first)).toBe(true);
  });

  test('parses the template as an expression', () => {
    const node = parseFirst('{% from "lib.html" import foo %}');
    const template = (node as { template: Node }).template;
    expect(getNodeTypeName(template)).toBe('literal');
    expect(template.value).toBe('lib.html');
  });

  test('defaults withContext to false', () => {
    const node = parseFirst('{% from "lib.html" import foo %}');
    expect((node as { withContext: boolean }).withContext).toBe(false);
  });

  test('parses with context flag', () => {
    const node = parseFirst('{% from "lib.html" import foo with context %}');
    expect((node as { withContext: boolean }).withContext).toBe(true);
  });

  test('parses without context flag', () => {
    const node = parseFirst('{% from "lib.html" import foo without context %}');
    expect((node as { withContext: boolean }).withContext).toBe(false);
  });

  test('rejects underscore-prefixed import names', () => {
    expect(() => parseFirst('{% from "lib.html" import _foo %}')).toThrow();
  });

  test('rejects "with" not followed by "context"', () => {
    expect(() => parseFirst('{% from "lib.html" import foo with ctx %}')).toThrow(
      /context/i
    );
  });

  test('a mid-list "with context" marker survives later names', () => {
    const node = parseFirst('{% from "lib.html" import a with context, b %}');
    expect((node as { withContext: boolean }).withContext).toBe(true);
  });
});
