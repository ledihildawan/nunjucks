import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';
import { nodes } from '../../nodes/index.js';

describe('parse - macro', () => {
  test('parses macro definition', () => {
    const ast = parse('{% macro hello() %}Hi{% endmacro %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('macro');
  });

  test('parses macro with args', () => {
    const ast = parse('{% macro hello(name) %}Hi {{ name }}{% endmacro %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('macro');
  });

  test('parses macro with default args', () => {
    const ast = parse('{% macro hello(name="World") %}Hi {{ name }}{% endmacro %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('macro');
  });

  test('parses caller macro', () => {
    const ast = parse('{% macro render() %}{{ caller() }}{% endmacro %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('macro');
  });
});

