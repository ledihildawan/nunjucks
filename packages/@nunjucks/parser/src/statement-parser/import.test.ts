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

describe('parseImport', () => {
  test('parses an import with as-target', () => {
    const node = parseFirst('{% import "lib.html" as lib %}');
    expect(getNodeTypeName(node)).toBe('import');
    expect((node as { template: Node }).template.value).toBe('lib.html');
    expect((node as { target: string }).target).toBe('lib');
  });

  test('defaults withContext to false', () => {
    const node = parseFirst('{% import "lib.html" as lib %}');
    expect((node as { withContext: boolean }).withContext).toBe(false);
  });

  test('parses with context flag', () => {
    const node = parseFirst('{% import "lib.html" as lib with context %}');
    expect((node as { withContext: boolean }).withContext).toBe(true);
  });

  test('parses without context flag', () => {
    const node = parseFirst('{% import "lib.html" as lib without context %}');
    expect((node as { withContext: boolean }).withContext).toBe(false);
  });

  test('rejects a missing as keyword', () => {
    expect(() => parseFirst('{% import "lib.html" lib %}')).toThrow();
  });
});