import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';
import { nodes } from '../../nodes/index.js';

describe('parse - function call', () => {
  test('parses function call with no args', () => {
    const ast = parse('{{ hello() }}');
    const output = ast.children[0];
    expect(nodes.getNodeTypeName(output)).toBe('output');
  });

  test('parses function call with positional args', () => {
    const ast = parse('{{ hello(a, b, c) }}');
    const output = ast.children[0];
    expect(nodes.getNodeTypeName(output)).toBe('output');
  });

  test('parses function call with kwargs', () => {
    const ast = parse('{{ hello(name="world") }}');
    const output = ast.children[0];
    expect(nodes.getNodeTypeName(output)).toBe('output');
  });

  test('parses function call with mixed args', () => {
    const ast = parse('{{ hello(a, b, name="c") }}');
    const output = ast.children[0];
    expect(nodes.getNodeTypeName(output)).toBe('output');
  });
});
