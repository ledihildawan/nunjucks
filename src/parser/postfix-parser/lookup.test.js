import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';
import { nodes } from '../../nodes/index.js';

describe('parse - bracket access', () => {
  test('parses bracket property access', () => {
    const ast = parse('{{ user["name"] }}');
    const output = ast.children[0];
    expect(nodes.getNodeTypeName(output)).toBe('output');
  });

  test('parses bracket access with variable', () => {
    const ast = parse('{{ user[key] }}');
    const output = ast.children[0];
    expect(nodes.getNodeTypeName(output)).toBe('output');
  });

  test('parses nested bracket access', () => {
    const ast = parse('{{ data["users"][0]["name"] }}');
    expect(ast.children).toHaveLength(1);
  });
});
