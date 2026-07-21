import { describe, test, expect } from 'bun:test';
import { parse } from '../index.ts';
import { getNodeTypeName } from '@nunjucks/nodes/traverse';

describe('parse - for statement', () => {
  test('parses simple for loop', () => {
    const ast = parse('{% for i in items %}{{ i }}{% endfor %}');
    expect(getNodeTypeName(ast.children[0])).toBe('for');
  });

  test('parses for-else', () => {
    const ast = parse('{% for i in items %}{{ i }}{% else %}empty{% endfor %}');
    expect(getNodeTypeName(ast.children[0])).toBe('for');
  });

  test('parses for with key-value', () => {
    const ast = parse('{% for k, v in obj %}{{ k }}{{ v }}{% endfor %}');
    expect(getNodeTypeName(ast.children[0])).toBe('for');
  });

  test('parses for over range', () => {
    const ast = parse('{% for i in range(10) %}{{ i }}{% endfor %}');
    expect(getNodeTypeName(ast.children[0])).toBe('for');
  });
});
