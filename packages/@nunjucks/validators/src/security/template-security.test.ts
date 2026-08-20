import { describe, expect, test } from 'bun:test';
import { scanTemplateForDangerousCode } from './template-security.ts';

describe('scanTemplateForDangerousCode', () => {
  test('returns empty for safe template', () => {
    const violations = scanTemplateForDangerousCode('Hello {{ name }}!');
    expect(violations).toEqual([]);
  });

  test('detects eval()', () => {
    const violations = scanTemplateForDangerousCode('{{ eval("1+1") }}');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.message).toBe('eval() is not allowed');
    expect(violations[0]!.pattern).toBe('\\beval\\s*\\(');
  });

  test('detects Function constructor', () => {
    const violations = scanTemplateForDangerousCode('{{ Function("return 1") }}');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.message).toBe('Function constructor is not allowed');
  });

  test('detects require()', () => {
    const violations = scanTemplateForDangerousCode('{{ require("fs") }}');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.message).toBe('require() is not allowed');
  });

  test('detects dynamic import()', () => {
    const violations = scanTemplateForDangerousCode('{{ import ("fs") }}');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]!.message).toBe('dynamic import() is not allowed');
  });

  test('returns correct line and column', () => {
    const template = 'line1\nline2\n{{ eval("x") }}\nline4';
    const violations = scanTemplateForDangerousCode(template);
    expect(violations[0]!.line).toBe(3);
    expect(violations[0]!.col).toBeGreaterThan(0);
  });

  test('detects multiple violations', () => {
    const template = '{{ eval("x") }} and {{ Function("y") }}';
    const violations = scanTemplateForDangerousCode(template);
    expect(violations.length).toBe(2);
  });

  test('does not flag safe uses', () => {
    const template = '{{ name }} and {{ upper(name) }}';
    const violations = scanTemplateForDangerousCode(template);
    expect(violations).toEqual([]);
  });

  test('detects across multiple lines', () => {
    const template = '{{\n eval("x")\n }}';
    const violations = scanTemplateForDangerousCode(template);
    expect(violations.length).toBe(1);
  });

  test('name field captures the identifier', () => {
    const template = '{{  eval("x")  }}';
    const violations = scanTemplateForDangerousCode(template);
    expect(violations[0]!.name).toBe('eval');
  });

  test('does not flag dangerous code inside string literals', () => {
    const template = '{{ "eval(1)" }}';
    const violations = scanTemplateForDangerousCode(template);
    expect(violations).toEqual([]);
  });

  test('does not flag dangerous code inside single-quoted strings', () => {
    const template = '{{ \'Function("return 1")\' }}';
    const violations = scanTemplateForDangerousCode(template);
    expect(violations).toEqual([]);
  });

  test('does not flag dangerous code inside template literals', () => {
    const template = '`require("fs")`';
    const violations = scanTemplateForDangerousCode(template);
    expect(violations).toEqual([]);
  });

  test('does not flag dangerous code inside HTML comments', () => {
    const template = '<!-- eval("x") -->';
    const violations = scanTemplateForDangerousCode(template);
    expect(violations).toEqual([]);
  });

  test('still detects dangerous code outside string literals', () => {
    const template = '{{ "eval(1)" }} {{ eval("x") }}';
    const violations = scanTemplateForDangerousCode(template);
    expect(violations.length).toBe(1);
    expect(violations[0]!.name).toBe('eval');
  });
});
