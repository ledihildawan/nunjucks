import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';
import { nodes } from '../../nodes/index.js';

describe('parse - block', () => {
  test('parses block definition', () => {
    const ast = parse('{% block title %}Default{% endblock %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('block');
  });

  test('parses block with content', () => {
    const ast = parse('{% block title %}Hello World{% endblock %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('block');
  });
});

describe('parse - extends', () => {
  test('parses extends', () => {
    const ast = parse('{% extends "base.html" %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('extends');
  });

  test('parses extends with variable', () => {
    const ast = parse('{% extends template %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('extends');
  });
});

describe('parse - include', () => {
  test('parses include', () => {
    const ast = parse('{% include "partial.html" %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('include');
  });

  test('parses include with ignore missing', () => {
    const ast = parse('{% include "partial.html" ignore missing %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('include');
  });
});

