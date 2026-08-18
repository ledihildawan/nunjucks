import { describe, expect, test } from 'bun:test';
import { wrapWithLog } from './diagnostics.ts';

describe('wrapWithLog', () => {
  test('wraps plain Error into TemplateError', async () => {
    const original = new Error('something went wrong');
    const wrapped = await wrapWithLog({ error: original, config: { phase: 'render' } });
    expect(wrapped).toBeInstanceOf(Error);
    expect((wrapped as Error).message).toContain('something went wrong');
  });

  test('preserves message from original error', async () => {
    const original = new TypeError('cannot read property');
    const wrapped = await wrapWithLog({ error: original, config: { phase: 'render' } });
    expect((wrapped as Error).message).toContain('cannot read property');
  });

  test('includes template source when provided', async () => {
    const original = new Error('test');
    const wrapped = await wrapWithLog({
      error: original,
      config: { phase: 'render' },
      template: '{{ x }}',
    });
    expect(wrapped).toBeDefined();
    expect(wrapped.message).toContain('test');
    expect(wrapped.code).toBeTruthy();
    expect(wrapped.templateName).toBeNull();
    expect(wrapped.lineno).toBeNull();
  });

  test('handles null render context', async () => {
    const original = new Error('test');
    const wrapped = await wrapWithLog({ error: original, config: { phase: 'render' } });
    expect(wrapped).toBeDefined();
    expect(wrapped.message).toContain('test');
    expect(wrapped.code).toBe('RENDER_ERROR');
    expect(wrapped.phase).toBe('render');
  });

  test('includes blockedContextKeys from config', async () => {
    const original = new Error('blocked');
    const wrapped = await wrapWithLog({
      error: original,
      config: {
        phase: 'render',
        blockedContextKeys: ['secret', 'password'],
      },
    });
    expect(wrapped).toBeDefined();
    expect(wrapped.message).toContain('blocked');
    expect(wrapped.blockedKeys).toEqual(['secret', 'password']);
  });

  test('threads the explicit environment label from config', async () => {
    const original = new Error('env probe');
    const wrapped = await wrapWithLog({
      error: original,
      config: { phase: 'render', environment: 'staging' },
    });
    expect(wrapped.environment).toBe('staging');
  });
});
