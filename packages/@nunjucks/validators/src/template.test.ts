import { describe, test, expect } from 'bun:test';
import { validateTemplate, type TemplateValidatorConfig } from './template.ts';
import { isOk, isErr } from '@nunjucks/lib';

describe('validateTemplate', () => {
  const safeConfig: TemplateValidatorConfig = {};

  test('valid template passes', () => {
    const result = validateTemplate('{{ name }}', safeConfig);
    expect(isOk(result)).toBe(true);
  });

  test('maxTemplateSize rejects oversized template', () => {
    const result = validateTemplate('x'.repeat(100), { maxTemplateSize: 50 });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0].code).toBe('TEMPLATE_SIZE_EXCEEDED');
    }
  });

  test('maxTemplateSize = 0 skips check', () => {
    const result = validateTemplate('x'.repeat(100), { maxTemplateSize: 0 });
    expect(isOk(result)).toBe(true);
  });

  test('strictMode detects dangerous code', () => {
    const result = validateTemplate('{{ eval("x") }}', { strictMode: true });
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0].code).toBe('DANGEROUS_TEMPLATE_CODE');
    }
  });

  test('non-strict mode skips dangerous code check', () => {
    const result = validateTemplate('{{ eval("x") }}', safeConfig);
    expect(isOk(result)).toBe(true);
  });

  test('clean template passes strict mode', () => {
    const result = validateTemplate('{{ name | upper }}', { strictMode: true });
    expect(isOk(result)).toBe(true);
  });
});
