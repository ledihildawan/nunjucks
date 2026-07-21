import { describe, test, expect } from 'bun:test';
import { parse } from '../index.ts';
import { getNodeTypeName } from '@nunjucks/nodes/traverse';

describe('parse - import', () => {
  test('parses import', () => {
    const ast = parse('{% import "helpers.html" as h %}');
    expect(getNodeTypeName(ast.children[0])).toBe('import');
  });

  test('parses from import', () => {
    const ast = parse('{% from "helpers.html" import foo %}');
    expect(getNodeTypeName(ast.children[0])).toBe('fromImport');
  });

  test('parses from import with alias', () => {
    const ast = parse('{% from "helpers.html" import foo as bar %}');
    expect(getNodeTypeName(ast.children[0])).toBe('fromImport');
  });

  test('parses from import multiple', () => {
    const ast = parse('{% from "helpers.html" import foo, bar %}');
    expect(getNodeTypeName(ast.children[0])).toBe('fromImport');
  });
});
