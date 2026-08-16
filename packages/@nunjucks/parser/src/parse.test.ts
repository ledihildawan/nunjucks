import { describe, expect, test } from 'bun:test';
import { isErr, isOk } from '@nunjucks/lib';
import { findAll, getNodeTypeName, isSymbol } from '@nunjucks/nodes';
import { parse } from './parse.ts';

describe('parse', () => {
  test('returns ok with a root node for valid template source', () => {
    const result = parse('Hello {{ name }}!');
    expect(isOk(result)).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(getNodeTypeName(result.value)).toBe('root');
    expect(result.value.children.length).toBeGreaterThan(0);
  });

  test('returns err for a syntax error instead of throwing', () => {
    const result = parse('{% if true %} {{ invalid');
    expect(isErr(result)).toBe(true);
    if (result.ok) {
      return;
    }
    expect(result.error.message.length).toBeGreaterThan(0);
  });

  test('returns err when expression security validation rejects the AST', () => {
    const result = parse('{{ __proto__ }}', { security: {} });
    expect(isErr(result)).toBe(true);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toContain('__proto__');
  });

  test('propagates non-template throws from extensions as programmer bugs', () => {
    const extension = {
      tags: ['boom'],
      parse: () => {
        throw new Error('extension bug');
      },
    };
    expect(() => parse('{% boom %}', { extensions: [extension] })).toThrow('extension bug');
  });

  test('a null-returning extension parse is a parse error, not a silent truncation', () => {
    const extension = {
      tags: ['customTag'],
      parse: () => null,
    };
    const result = parse('before {% customTag %} after', { extensions: [extension] });
    expect(isErr(result)).toBe(true);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe('PARSER_ERROR');
    expect(result.error.message).toContain('customTag');
  });

  test('parses a large array literal without stack overflow', () => {
    const source = `{{ [${Array.from({ length: 20_000 }, (_, itemIndex) => itemIndex).join(',')}] }}`;
    const result = parse(source);
    expect(isOk(result)).toBe(true);
  });

  test('findAll reaches symbols inside template literal quasi envelopes', () => {
    const result = parse('{{ `prefix$' + '{dangerous}` }}');
    expect(isOk(result)).toBe(true);
    if (!result.ok) {
      return;
    }
    const symbols = findAll(result.value, (node) => isSymbol(node) && node.value === 'dangerous');
    expect(symbols).toHaveLength(1);
  });

  test('findAll reaches include-with expressions', () => {
    const result = parse('{% include "partial.njk" with extraContext %}');
    expect(isOk(result)).toBe(true);
    if (!result.ok) {
      return;
    }
    const symbols = findAll(
      result.value,
      (node) => isSymbol(node) && node.value === 'extraContext'
    );
    expect(symbols).toHaveLength(1);
  });

  test('security validation rejects dangerous symbols inside template literals', () => {
    const result = parse('{{ `prefix$' + '{__proto__}` }}', { security: {} });
    expect(isErr(result)).toBe(true);
  });
});
