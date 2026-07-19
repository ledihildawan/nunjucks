import { describe, test, expect } from 'bun:test';
import { parse } from './index.js';
import { nodes } from '../nodes/index.js';

describe('parse function', () => {
  test('parses plain text', () => {
    const result = parse('Hello world');
    expect(nodes.getNodeTypeName(result)).toBe('root');
    expect(result.children.length).toBe(1);
  });

  test('parses variable expression', () => {
    const result = parse('{{ name }}');
    expect(nodes.getNodeTypeName(result)).toBe('root');
    expect(result.children).toHaveLength(1);
  });

  test('parses block', () => {
    const result = parse('{% if x %}y{% endif %}');
    expect(nodes.getNodeTypeName(result)).toBe('root');
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

  test('throws on unexpected token', () => {
    expect(() => parse('{{')).toThrow();
  });
});
