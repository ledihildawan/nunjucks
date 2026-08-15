import { describe, expect, test } from 'bun:test';
import type { TemplateError } from '@nunjucks/error-formatter';
import { renderTemplate } from './render-test-helper.ts';

describe('sandbox security - prototype pollution', () => {
  test('__proto__ access throws in sandbox mode', async () => {
    const err = (await renderTemplate(
      '{{ obj.__proto__ }}',
      { obj: { safe: 'value' } },
      { sandbox: true }
    ).catch((e) => e)) as TemplateError;
    expect(err.code).toBe('SANDBOX_ACCESS');
  });

  test('constructor access throws in sandbox mode', async () => {
    const err = (await renderTemplate(
      '{{ obj.constructor }}',
      { obj: { safe: 'value' } },
      { sandbox: true }
    ).catch((e) => e)) as TemplateError;
    expect(err.code).toBe('SANDBOX_ACCESS');
  });

  test('prototype access throws in sandbox mode', async () => {
    const err = (await renderTemplate(
      '{{ obj.prototype }}',
      { obj: { safe: 'value' } },
      { sandbox: true }
    ).catch((e) => e)) as TemplateError;
    expect(err.code).toBe('SANDBOX_ACCESS');
  });

  test('nested __proto__ access throws', async () => {
    const err = (await renderTemplate(
      '{{ user.inner.__proto__ }}',
      { user: { inner: { safe: 'value' } } },
      { sandbox: true }
    ).catch((e) => e)) as TemplateError;
    expect(err.code).toBe('SANDBOX_ACCESS');
  });

  test('__proto__ setting throws in sandbox mode', async () => {
    const err = (await renderTemplate(
      '{% set obj.__proto__ = {} %}',
      { obj: {} },
      { sandbox: true, dev: true }
    ).catch((e) => e)) as TemplateError;
    expect(err.code).toBeTruthy();
  });

  test('prototype setting throws in sandbox mode', async () => {
    const err = (await renderTemplate(
      '{% set obj.prototype = {} %}',
      { obj: {} },
      { sandbox: true, dev: true }
    ).catch((e) => e)) as TemplateError;
    expect(err.code).toBeTruthy();
  });
});

describe('sandbox security - code execution patterns', () => {
  test('eval is blocked in sandbox mode', async () => {
    const err = (await renderTemplate('{{ eval("1+1") }}', {}, { sandbox: true }).catch(
      (e) => e
    )) as TemplateError;
    expect(err).toBeDefined();
  });

  test('Function constructor is blocked', async () => {
    const err = (await renderTemplate('{{ Function("return 1")() }}', {}, { sandbox: true }).catch(
      (e) => e
    )) as TemplateError;
    expect(err).toBeDefined();
  });

  test('setTimeout with string code is blocked', async () => {
    const err = (await renderTemplate(
      '{{ setTimeout("alert(1)", 0) }}',
      { setTimeout: () => 'blocked' },
      { sandbox: true }
    ).catch((e) => e)) as TemplateError;
    expect(err).toBeDefined();
  });

  test('import is blocked', async () => {
    const err = (await renderTemplate('{{ import("fs") }}', {}, { sandbox: true }).catch(
      (e) => e
    )) as TemplateError;
    expect(err).toBeDefined();
  });
});

describe('sandbox security - dangerous globals', () => {
  test('process access is blocked in node environment', async () => {
    const err = (await renderTemplate(
      '{{ process.env.NODE_ENV }}',
      { process: { env: { NODE_ENV: 'test' } } },
      { sandbox: true, sandboxEnvironment: 'node' }
    ).catch((e) => e)) as TemplateError;
    expect(err.code).toBe('SANDBOX_ACCESS');
  });

  test('globalThis access is blocked', async () => {
    const err = (await renderTemplate(
      '{{ globalThis }}',
      { globalThis: 'blocked' },
      { sandbox: true }
    ).catch((e) => e)) as TemplateError;
    expect(err.code).toBe('SANDBOX_ACCESS');
  });

  test('data named like globals is still accessible', async () => {
    const result = await renderTemplate(
      '{{ user.process }}',
      { user: { process: 'workflow' } },
      { sandbox: true }
    );
    expect(result).toContain('workflow');
  });
});

describe('sandbox security - context validation', () => {
  test('contextStrict error mode throws on dangerous values', async () => {
    const err = (await renderTemplate(
      '{{ user.global }}',
      { user: { name: 'Ada', global: process } },
      { sandbox: true, contextStrict: 'error', dev: true }
    ).catch((e) => e)) as TemplateError;
    expect(err.code).toBe('DANGEROUS_CONTEXT_VALUES');
  });

  test('contextStrict warn mode scrubs dangerous values', async () => {
    const result = await renderTemplate(
      '{{ user.name }}',
      { user: { name: 'Ada', global: process } },
      { sandbox: true, contextStrict: 'warn', dev: true }
    );
    expect(result).toContain('Ada');
    expect(result).not.toContain('[object Object]');
  });
});

describe('sandbox security - member access', () => {
  test('bracket access with dangerous key throws', async () => {
    const err = (await renderTemplate(
      '{{ obj["__proto__"] }}',
      { obj: { safe: 'value' } },
      { sandbox: true }
    ).catch((e) => e)) as TemplateError;
    expect(err.code).toBe('SANDBOX_ACCESS');
  });

  test('optional chaining with dangerous key throws', async () => {
    const err = (await renderTemplate(
      '{{ obj?.__proto__ }}',
      { obj: { safe: 'value' } },
      { sandbox: true }
    ).catch((e) => e)) as TemplateError;
    expect(err.code).toBe('SANDBOX_ACCESS');
  });
});
