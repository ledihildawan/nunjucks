import { describe, expect, test } from 'bun:test';
import type { TemplateError } from '@nunjucks/error-formatter';
import { renderTemplate } from './render-test-helper.ts';

describe('sandbox security - prototype pollution', () => {
  test('constructor.constructor code execution is blocked even WITHOUT sandbox', async () => {
    const err = (await renderTemplate(
      '{{ user.constructor.constructor("return 41+1")() }}',
      { user: {} }
    ).catch((e) => e)) as TemplateError;
    expect(err.code).toBeTruthy();
  });

  test('primitive constructor chain is blocked in default mode', async () => {
    const err = (await renderTemplate(
      '{{ "abc"["constructor"]["constructor"]("return 1")() }}',
      {}
    ).catch((e) => e)) as TemplateError;
    expect(err.code).toBeTruthy();
  });

  test('legit inherited methods keep working in default mode', async () => {
    const output = await renderTemplate('{{ "abc".toUpperCase() }}', {});
    expect(output).toBe('ABC');
  });

  test('top-level constructor resolves to nothing in default mode', async () => {
    const output = await renderTemplate('{{ constructor ?? "blocked" }}', {});
    expect(output).toBe('blocked');
  });

  test('nested process reference is blocked in sandbox mode (depth guard)', async () => {
    const err = (await renderTemplate(
      '{{ user.process.env.PATH }}',
      { user: { process } },
      { sandbox: true }
    ).catch((e) => e)) as TemplateError;
    expect(err.code).toBe('SANDBOX_ACCESS');
  });

  test('nested globalThis reference is blocked in sandbox mode', async () => {
    const err = (await renderTemplate(
      '{{ user.shell }}',
      { user: { shell: globalThis } },
      { sandbox: true }
    ).catch((e) => e)) as TemplateError;
    expect(err.code).toBe('SANDBOX_ACCESS');
  });

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

  // WHY: {% set %} is gone — assignment uses the walrus `:=`, which only accepts
  // symbol/pattern targets (parseWalrusAssignment rejects member lookups with
  // WALRUS_TARGET_INVALID). Prototype-mutation via assignment is therefore
  // unrepresentable at the template level; these tests pin that guard.
  test('walrus assignment to __proto__ member is rejected at parse time', async () => {
    const err = (await renderTemplate('{{ obj.__proto__ := {} }}', { obj: {} }, {}).catch(
      (e) => e
    )) as TemplateError;
    expect(err.code).toBe('WALRUS_TARGET_INVALID');
  });

  test('walrus assignment to prototype member is rejected at parse time', async () => {
    const err = (await renderTemplate('{{ obj.prototype := {} }}', { obj: {} }, {}).catch(
      (e) => e
    )) as TemplateError;
    expect(err.code).toBe('WALRUS_TARGET_INVALID');
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

  test('sandbox allowlist cannot unblock categorically blocked keys', async () => {
    // WHY: pins the trap check order in sandbox-traps.ts — blocked-at-scope runs BEFORE the
    // allowlist, so merging blocked names into sandboxAllowlist must remain ineffective.
    const err = (await renderTemplate(
      '{{ process }}',
      { process: { env: { NODE_ENV: 'test' } } },
      {
        sandbox: true,
        sandboxEnvironment: 'node',
        sandboxAllowlist: ['process', 'require', 'constructor'],
      }
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
