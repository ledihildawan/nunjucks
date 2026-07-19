import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';
import { nodes } from '../../nodes/index.js';

describe('parse - set statement', () => {
  test('parses simple set', () => {
    const ast = parse('{% set x = 1 %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('set');
  });

  test('parses set with expression', () => {
    const ast = parse('{% set x = 1 + 2 %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('set');
  });

  test('parses set with tuple', () => {
    const ast = parse('{% set x, y = [1, 2] %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('set');
  });

  test('parses set raw', () => {
    const ast = parse('{% set x %}{% endset %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('set');
  });
});

