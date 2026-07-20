import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';

describe('parse - spread operator', () => {
  test('parses array spread', () => {
    const ast = parse('{{ [...items] }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses object spread', () => {
    const ast = parse('{{ {...obj} }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses multiple spreads in array', () => {
    const ast = parse('{{ [...a, ...b] }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses spread with literals', () => {
    const ast = parse('{{ [1, 2, ...items] }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses spread in object with other keys', () => {
    const ast = parse('{{ {...defaults, key: value} }}');
    expect(ast.children).toHaveLength(1);
  });
});
