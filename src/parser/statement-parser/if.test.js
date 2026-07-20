import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';
import { nodes } from '../../nodes/index.js';

describe('parse - if statement', () => {
  test('parses simple if', () => {
    const ast = parse('{% if x %}yes{% endif %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('if');
  });

  test('parses if-else', () => {
    const ast = parse('{% if x %}yes{% else %}no{% endif %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('if');
  });

  test('parses if-elif-else', () => {
    const ast = parse('{% if x %}a{% elif y %}b{% else %}c{% endif %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('if');
  });

  test('parses nested if', () => {
    const ast = parse('{% if x %}{% if y %}yes{% endif %}{% endif %}');
    expect(ast.children).toHaveLength(1);
  });
});

