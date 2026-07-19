import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';
import { nodes } from '../../nodes/index.js';

describe('parse - arithmetic', () => {
  test('parses add', () => {
    const ast = parse('{{ a + b }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses subtract', () => {
    const ast = parse('{{ a - b }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses multiply', () => {
    const ast = parse('{{ a * b }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses divide', () => {
    const ast = parse('{{ a / b }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses floor divide', () => {
    const ast = parse('{{ a // b }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses modulo', () => {
    const ast = parse('{{ a % b }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses power', () => {
    const ast = parse('{{ a ** b }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses complex arithmetic', () => {
    const ast = parse('{{ (a + b) * c - d / 2 }}');
    expect(ast.children).toHaveLength(1);
  });
});
