import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';
import { nodes } from '../../nodes/index.js';

describe('parse - comparison', () => {
  test('parses ==', () => {
    const ast = parse('{{ a == b }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses !=', () => {
    const ast = parse('{{ a != b }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses >', () => {
    const ast = parse('{{ a > b }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses >=', () => {
    const ast = parse('{{ a >= b }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses <', () => {
    const ast = parse('{{ a < b }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses <=', () => {
    const ast = parse('{{ a <= b }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses chained comparison', () => {
    const ast = parse('{{ a < b < c }}');
    expect(ast.children).toHaveLength(1);
  });
});
