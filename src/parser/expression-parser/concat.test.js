import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';

describe('parse - string concatenation', () => {
  test('parses ~ operator', () => {
    const ast = parse('{{ "hello" ~ "world" }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses mixed concatenation', () => {
    const ast = parse('{{ name ~ " is " ~ age }}');
    expect(ast.children).toHaveLength(1);
  });
});

describe('parse - data', () => {
  test('parses plain text', () => {
    const ast = parse('Hello World');
    expect(ast.children).toHaveLength(1);
  });

  test('parses text with newlines', () => {
    const ast = parse('Line 1\nLine 2');
    expect(ast.children).toHaveLength(1);
  });

  test('parses mixed text and variables', () => {
    const ast = parse('Hello {{ name }}!');
    expect(ast.children).toHaveLength(3);
  });
});
