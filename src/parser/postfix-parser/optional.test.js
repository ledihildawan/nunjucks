import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';
import { nodes } from '../../nodes/index.js';

describe('parse - optional chaining', () => {
  test('parses optional property access', () => {
    const ast = parse('{{ user?.name }}');
    const output = ast.children[0];
    expect(nodes.getNodeTypeName(output)).toBe('output');
  });

  test('parses optional method call', () => {
    const ast = parse('{{ user?.getName() }}');
    const output = ast.children[0];
    expect(nodes.getNodeTypeName(output)).toBe('output');
  });

  test('parses optional call without args', () => {
    const ast = parse('{{ fn?.() }}');
    const output = ast.children[0];
    expect(nodes.getNodeTypeName(output)).toBe('output');
  });

  test('parses nested optional chaining', () => {
    const ast = parse('{{ user?.profile?.name }}');
    expect(ast.children).toHaveLength(1);
  });
});
