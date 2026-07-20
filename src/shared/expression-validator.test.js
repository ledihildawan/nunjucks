import { describe, test, expect } from 'bun:test';
import { parse } from '../parser/index.js';

describe('expression security validation', () => {
  test('allows normal property access', () => {
    const ast = parse('{{ user.name }}', undefined, { security: {} });
    expect(ast).toBeDefined();
  });

  test('allows normal method calls', () => {
    const ast = parse('{{ user.getName() }}', undefined, { security: {} });
    expect(ast).toBeDefined();
  });

  test('allows safe symbols', () => {
    const ast = parse('{{ name }}', undefined, { security: {} });
    expect(ast).toBeDefined();
  });

  test('blocks dangerous properties by default', () => {
    expect(() => {
      parse('{{ user.__proto__ }}', undefined, { security: {} });
    }).toThrow();
  });

  test('blocks constructor access by default', () => {
    expect(() => {
      parse('{{ user.constructor }}', undefined, { security: {} });
    }).toThrow();
  });

  test('blocks eval function', () => {
    expect(() => {
      parse('{{ eval("dangerous") }}', undefined, { security: {} });
    }).toThrow();
  });

  test('blocks Function constructor', () => {
    expect(() => {
      parse('{{ Function("dangerous") }}', undefined, { security: {} });
    }).toThrow();
  });

  test('allows custom blocked patterns', () => {
    expect(() => {
      parse('{{ user.secretKey }}', undefined, { 
        security: { blockedPropertyPatterns: [/^secret/] } 
      });
    }).toThrow();
  });

  test('allows properties not matching blocked patterns', () => {
    const ast = parse('{{ user.publicKey }}', undefined, { 
      security: { blockedPropertyPatterns: [/^secret/] } 
    });
    expect(ast).toBeDefined();
  });

  test('allows when security config is empty', () => {
    const ast = parse('{{ user.__proto__ }}');
    expect(ast).toBeDefined();
  });

  test('works with blocks', () => {
    const ast = parse('{% if user.name %}{{ user.name }}{% endif %}', undefined, { security: {} });
    expect(ast).toBeDefined();
  });

  test('works with loops', () => {
    const ast = parse('{% for item in items %}{{ item.name }}{% endfor %}', undefined, { security: {} });
    expect(ast).toBeDefined();
  });
});
