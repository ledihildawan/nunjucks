import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';
import { nodes } from '../../nodes/index.js';

describe('parse - logical operators', () => {
  test('parses and', () => {
    const ast = parse('{{ a and b }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses or', () => {
    const ast = parse('{{ a or b }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses not', () => {
    const ast = parse('{{ not a }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses complex logical', () => {
    const ast = parse('{{ not (a and b) or c }}');
    expect(ast.children).toHaveLength(1);
  });
});

describe('parse - nullish coalescing', () => {
  test('parses ?? operator', () => {
    const ast = parse('{{ a ?? b }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses chained ??', () => {
    const ast = parse('{{ a ?? b ?? c }}');
    expect(ast.children).toHaveLength(1);
  });
});

describe('parse - in operator', () => {
  test('parses in', () => {
    const ast = parse('{{ a in items }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses not in', () => {
    const ast = parse('{{ a not in items }}');
    expect(ast.children).toHaveLength(1);
  });
});

describe('parse - is operator', () => {
  test('parses is defined', () => {
    const ast = parse('{{ value is defined }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses is string', () => {
    const ast = parse('{{ value is string }}');
    expect(ast.children).toHaveLength(1);
  });

  test('parses is number', () => {
    const ast = parse('{{ value is number }}');
    expect(ast.children).toHaveLength(1);
  });
});
