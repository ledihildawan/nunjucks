import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';

describe('parse - unary operators', () => {
  test('parses negative', () => {
    const ast = parse('{{ -x }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses positive', () => {
    const ast = parse('{{ +x }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses negation', () => {
    const ast = parse('{{ not x }}');
    expect(ast.children).toHaveLength(1);
  });
});

describe('parse - ternary expression', () => {
  test('parses inline if', () => {
    const ast = parse('{{ a if cond else b }}');
    expect(ast.children).toHaveLength(1);
  });
});
