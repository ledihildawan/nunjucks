import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';
import { nodes } from '../../nodes/index.js';

describe('parse - with statement', () => {
  test('parses with expression', () => {
    const ast = parse('{% with x = 1 %}{{ x }}{% endwith %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('with');
  });

  test('parses without expression', () => {
    const ast = parse('{% with %}{{ x }}{% endwith %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('with');
  });
});

describe('parse - raw', () => {
  test('parses raw block', () => {
    const ast = parse('{% raw %}{{ raw }}{% endraw %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses raw with special chars', () => {
    const ast = parse('{% raw %}{% if %}{% endif %}{% endraw %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });
});

