import { describe, test, expect } from 'bun:test';
import { parse } from './index.js';
import { nodes } from '../nodes/index.js';

describe('parse - variables', () => {
  test('parses simple variable', () => {
    const ast = parse('{{ name }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });
});

describe('parse - expressions', () => {
  test('parses arithmetic add', () => {
    const ast = parse('{{ a + b }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses arithmetic subtract', () => {
    const ast = parse('{{ a - b }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses arithmetic multiply', () => {
    const ast = parse('{{ a * b }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses comparison', () => {
    const ast = parse('{{ a == b }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses logical and', () => {
    const ast = parse('{{ a and b }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses logical or', () => {
    const ast = parse('{{ a or b }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses ternary expression', () => {
    const ast = parse('{{ a if cond else b }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses nullish coalescing', () => {
    const ast = parse('{{ a ?? b }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses in operator', () => {
    const ast = parse('{{ a in items }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses is operator', () => {
    const ast = parse('{{ value is defined }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });
});

describe('parse - data types', () => {
  test('parses string literal', () => {
    const ast = parse('{{ "hello" }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses number literal', () => {
    const ast = parse('{{ 42 }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses boolean literal', () => {
    const ast = parse('{{ true }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses null literal', () => {
    const ast = parse('{{ null }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses array literal', () => {
    const ast = parse('{{ [1, 2, 3] }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses object literal', () => {
    const ast = parse('{{ { a: 1, b: 2 } }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });
});

describe('parse - statements', () => {
  test('parses if statement', () => {
    const ast = parse('{% if x %}yes{% endif %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('if');
  });

  test('parses if-else statement', () => {
    const ast = parse('{% if x %}yes{% else %}no{% endif %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('if');
  });

  test('parses if-elif-else statement', () => {
    const ast = parse('{% if x %}a{% elif y %}b{% else %}c{% endif %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('if');
  });

  test('parses for loop', () => {
    const ast = parse('{% for i in items %}{{ i }}{% endfor %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('for');
  });

  test('parses for-else loop', () => {
    const ast = parse('{% for i in items %}{{ i }}{% else %}empty{% endfor %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('for');
  });

  test('parses macro', () => {
    const ast = parse('{% macro hello(name) %}Hi {{ name }}{% endmacro %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('macro');
  });

  test('parses block', () => {
    const ast = parse('{% block title %}Default{% endblock %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('block');
  });

  test('parses extends', () => {
    const ast = parse('{% extends "base.html" %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('extends');
  });

  test('parses include', () => {
    const ast = parse('{% include "partial.html" %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('include');
  });

  test('parses import', () => {
    const ast = parse('{% import "helpers.html" as h %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('import');
  });

  test('parses from import', () => {
    const ast = parse('{% from "helpers.html" import foo %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('fromImport');
  });

  test('parses switch', () => {
    const ast = parse('{% switch x %}{% case 1 %}one{% case 2 %}two{% endswitch %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('switch');
  });

  test('parses raw', () => {
    const ast = parse('{% raw %}{{ raw }}{% endraw %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });
});

describe('parse - member access', () => {
  test('parses dot access', () => {
    const ast = parse('{{ user.name }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses bracket access', () => {
    const ast = parse('{{ user["name"] }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses optional chaining', () => {
    const ast = parse('{{ user?.name }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses optional call', () => {
    const ast = parse('{{ fn?.() }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });

  test('parses function call', () => {
    const ast = parse('{{ fn(arg1, arg2) }}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('output');
  });
});

describe('parse - errors', () => {
  test('throws on unclosed variable', () => {
    expect(() => parse('{{')).toThrow();
  });

  test('throws on unclosed block', () => {
    expect(() => parse('{% if')).toThrow();
  });

  test('throws on unclosed string', () => {
    expect(() => parse('{{ "unclosed }}')).toThrow();
  });

  test('throws on unexpected endif', () => {
    expect(() => parse('{% endif %}')).toThrow();
  });

  test('throws on invalid expression', () => {
    expect(() => parse('{{ ) }}')).toThrow();
  });
});

describe('parse function', () => {
  test('parses plain text', () => {
    const result = parse('Hello world');
    expect(nodes.getNodeTypeName(result)).toBe('root');
    expect(result.children.length).toBe(1);
  });

  test('passes extensions to parser', () => {
    const ext = { tags: ['custom'], parse: () => null };
    const result = parse('Hello', [ext]);
    expect(nodes.getNodeTypeName(result)).toBe('root');
  });

  test('passes opts to lexer', () => {
    const result = parse('Hello', undefined, { autoescape: true });
    expect(nodes.getNodeTypeName(result)).toBe('root');
  });
});
