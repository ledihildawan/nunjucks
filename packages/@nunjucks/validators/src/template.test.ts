import { describe, expect, test } from 'bun:test';
import { validateTemplate } from './template.ts';

describe('validateTemplate', () => {
  test('is valid for a clean template with no config', () => {
    expect(validateTemplate('Hello {{ name }}', {}).valid).toBe(true);
  });

  test('does not scan for dangerous code unless strict', () => {
    const result = validateTemplate('{{ eval("x") }}', {});
    expect(result.valid).toBe(true);
  });

  test('flags eval under strictMode', () => {
    const result = validateTemplate('{{ eval("x") }}', { strictMode: true });
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('DANGEROUS_TEMPLATE_CODE');
    expect(result.errors[0]?.violations?.[0]?.name).toBe('eval');
  });

  test('flags Function constructor under strictMode', () => {
    const result = validateTemplate('{{ Function("return 1") }}', { strictMode: true });
    expect(result.valid).toBe(false);
  });

  test('reports the first violation line/col', () => {
    const result = validateTemplate('line1\n{{ eval("x") }}', { strictMode: true });
    const violation = result.errors[0]?.violations?.[0];
    expect(violation?.line).toBe(2);
    expect(typeof violation?.col).toBe('number');
  });

  test('enforces maxTemplateSize', () => {
    const result = validateTemplate('abc', { maxTemplateSize: 2 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('TEMPLATE_SIZE_EXCEEDED');
  });

  test('maxTemplateSize of 0 disables the size check', () => {
    expect(validateTemplate('abc', { maxTemplateSize: 0 }).valid).toBe(true);
  });
});
