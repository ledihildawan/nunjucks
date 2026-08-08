import { describe, test, expect } from 'bun:test';
import { renderTemplate } from './render-test-helper.ts';
import process from "node:process";

describe('inline template sandbox and contextStrict', () => {
  test('scrubs dangerous global references from context in dev mode and emits a warning', async () => {
    const ctx = { user: { name: 'Ada', global: process } };
    const html = await renderTemplate('{{ user.name }}', ctx, { dev: true, contextStrict: 'warn' });
    expect(html).toStartWith('Ada');
    expect(html).toContain('Scrubbed unsafe values from context: user.global');
    expect(ctx.user.global).toBe(process);
    expect('global' in ctx.user).toBe(true);
  });

  test('throws DANGEROUS_CONTEXT_VALUES when contextStrict is error', async () => {
    const err = await renderTemplate('{{ user.global }}', {
      user: { name: 'Ada', global: process }
    }, { dev: true, contextStrict: 'error' }).catch(e => e);

    expect(err.code).toBe('DANGEROUS_CONTEXT_VALUES');
    expect(err.subject).toContain('user.global');
    expect(err.lineBase).toBe('one');
  });

  test('does not scrub when contextStrict is false and dev is false', async () => {
    const html = await renderTemplate('{{ user.name }}', {
      user: { name: 'Ada', global: process }
    }, { dev: false, contextStrict: false });
    expect(html).toBe('Ada');
  });

  test('applies sandboxEnvironment to render context access', async () => {
    const html = await renderTemplate('{{ document.title }}', {
      document: { title: 'node scoped value' }
    }, {
      sandbox: true,
      sandboxEnvironment: 'node',
      contextStrict: false
    });
    const err = await renderTemplate('{{ process.env }}', {
      process: { env: {} }
    }, {
      sandbox: true,
      sandboxEnvironment: 'node',
      contextStrict: false
    }).catch(e => e);

    expect(html).toBe('node scoped value');
    expect(err.code).toBe('SANDBOX_ACCESS');
    expect(err.subject).toBe('process');
  });

  test('allows nested context fields named like globals in sandbox mode', async () => {
    const html = await renderTemplate('{{ user.eval }} {{ user.global }}', {
      user: {
        eval: 'profile',
        global: 'team'
      }
    }, {
      sandbox: true
    });

    expect(html).toBe('profile team');
  });

  test('blocks constructor-chain escapes in sandbox mode', async () => {
    const err = await renderTemplate('{{ user.constructor.constructor("return process")() }}', {
      user: { name: 'Ada' }
    }, {
      sandbox: true
    }).catch(e => e);

    expect(err.code).toBe('SANDBOX_ACCESS');
    expect(err.subject).toBe('constructor');
  });

  test('does not expose inherited context properties in sandbox mode', async () => {
    const parent = { inheritedSecret: 'hidden' };
    const user = Object.create(parent);
    user.name = 'Ada';

    const html = await renderTemplate('{{ user.name }}:{{ user.inheritedSecret }}', {
      user
    }, {
      sandbox: true
    });

    expect(html).toBe('Ada:undefined');
    expect(html).not.toContain('hidden');
  });

  test('does not invoke blocked-key getters in sandbox mode', async () => {
    let getterCalled = false;
    const user = {};
    Object.defineProperty(user, 'constructor', {
      enumerable: true,
      get() {
        getterCalled = true;
        return Function;
      }
    });

    const err = await renderTemplate('{{ user.constructor }}', {
      user
    }, {
      sandbox: true
    }).catch(e => e);

    expect(err.code).toBe('SANDBOX_ACCESS');
    expect(err.subject).toBe('constructor');
    expect(getterCalled).toBe(false);
  });
});
