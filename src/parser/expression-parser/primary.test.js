import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';

describe('parse - literals', () => {
  test('parses string literal', () => {
    const ast = parse('{{ "hello" }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses single quoted string', () => {
    const ast = parse("{{ 'hello' }}");
    expect(ast.children).toHaveLength(1);
  });

  test('parses number integer', () => {
    const ast = parse('{{ 42 }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses number float', () => {
    const ast = parse('{{ 3.14 }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses boolean true', () => {
    const ast = parse('{{ true }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses boolean false', () => {
    const ast = parse('{{ false }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses null', () => {
    const ast = parse('{{ null }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses undefined', () => {
    const ast = parse('{{ undefined }}');
    expect(ast.children).toHaveLength(1);
  });
});

describe('parse - aggregates', () => {
  test('parses array literal', () => {
    const ast = parse('{{ [1, 2, 3] }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses object literal', () => {
    const ast = parse('{{ { a: 1, b: 2 } }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses tuple literal', () => {
    const ast = parse('{{ (1, 2, 3) }}');
    expect(ast.children).toHaveLength(1);
  });
});
