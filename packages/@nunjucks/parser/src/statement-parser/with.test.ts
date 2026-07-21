import { describe, test, expect } from 'bun:test';
import { parse } from '../index.ts';
import { getNodeTypeName } from '@nunjucks/nodes/traverse';

describe('parse - with statement', () => {
  test('parses with expression', () => {
    const ast = parse('{% with x = 1 %}{{ x }}{% endwith %}');
    expect(getNodeTypeName(ast.children[0])).toBe('with');
  });

  test('parses without expression', () => {
    const ast = parse('{% with %}{{ x }}{% endwith %}');
    expect(getNodeTypeName(ast.children[0])).toBe('with');
  });
});

describe('parse - raw', () => {
  test('parses raw block', () => {
    const ast = parse('{% raw %}{{ raw }}{% endraw %}');
    expect(getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses raw with special chars', () => {
    const ast = parse('{% raw %}{% if %}{% endif %}{% endraw %}');
    expect(getNodeTypeName(ast.children[0])).toBe('output');
  });
});
