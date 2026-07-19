import { describe, test, expect } from 'bun:test';
import { parse } from '../index.js';
import { nodes } from '../../nodes/index.js';

describe('parse - import', () => {
  test('parses import', () => {
    const ast = parse('{% import "helpers.html" as h %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('import');
  });

  test('parses from import', () => {
    const ast = parse('{% from "helpers.html" import foo %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('fromImport');
  });

  test('parses from import with alias', () => {
    const ast = parse('{% from "helpers.html" import foo as bar %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('fromImport');
  });

  test('parses from import multiple', () => {
    const ast = parse('{% from "helpers.html" import foo, bar %}');
    expect(nodes.getNodeTypeName(ast.children[0])).toBe('fromImport');
  });
});

