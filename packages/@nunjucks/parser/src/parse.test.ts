import { describe, expect, test } from 'bun:test';
import { isErr, isOk } from '@nunjucks/lib';
import { getNodeTypeName } from '@nunjucks/nodes';
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
});
