import { describe, test, expect } from 'bun:test';
import { parse } from '../index.ts';
import { getNodeTypeName } from '@nunjucks/nodes/traverse';

describe('parse - macro', () => {
  test('parses macro definition', () => {
    const ast = parse('{% macro hello() %}Hi{% endmacro %}');
    expect(getNodeTypeName(ast.children[0])).toBe('macro');
  });

  test('parses macro with args', () => {
    const ast = parse('{% macro hello(name) %}Hi {{ name }}{% endmacro %}');
    expect(getNodeTypeName(ast.children[0])).toBe('macro');
  });

  test('parses macro with default args', () => {
    const ast = parse('{% macro hello(name="World") %}Hi {{ name }}{% endmacro %}');
    expect(getNodeTypeName(ast.children[0])).toBe('macro');
  });

  test('parses caller macro', () => {
    const ast = parse('{% macro render() %}{{ caller() }}{% endmacro %}');
    expect(getNodeTypeName(ast.children[0])).toBe('macro');
  });
});
