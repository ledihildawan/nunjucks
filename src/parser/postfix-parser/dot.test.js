import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';
import { nodes } from '../../nodes/index.js';

describe('parse - dot access', () => {
  test('parses dot property access', () => {
    const ast = parse('{{ user.name }}');
    const output = ast.children[0];
    expect(nodes.getNodeTypeName(output)).toBe('output');
  });

  test('parses nested dot access', () => {
    const ast = parse('{{ user.profile.name }}');
    const output = ast.children[0];
    expect(nodes.getNodeTypeName(output)).toBe('output');
  });

  test('parses method call', () => {
    const ast = parse('{{ user.getName() }}');
    const output = ast.children[0];
    expect(nodes.getNodeTypeName(output)).toBe('output');
  });

  test('parses method call with args', () => {
    const ast = parse('{{ user.greet("hello") }}');
    const output = ast.children[0];
    expect(nodes.getNodeTypeName(output)).toBe('output');
  });
});
