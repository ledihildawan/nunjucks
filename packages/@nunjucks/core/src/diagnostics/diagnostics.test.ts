import { describe, test, expect } from 'bun:test';
import { wrapWithLog } from './diagnostics.ts';

describe('wrapWithLog', () => {
  test('wraps plain Error into TemplateError', async () => {
    const original = new Error('something went wrong');
    const wrapped = await wrapWithLog(original, { phase: 'render' });
    expect(wrapped).toBeInstanceOf(Error);
    expect((wrapped as Error).message).toContain('something went wrong');
  });

  test('preserves message from original error', async () => {
    const original = new TypeError('cannot read property');
    const wrapped = await wrapWithLog(original, { phase: 'render' });
    expect((wrapped as Error).message).toContain('cannot read property');
  });

  test('includes template source when provided', async () => {
    const original = new Error('test');
    const wrapped = await wrapWithLog(original, { phase: 'render' }, { template: '{{ x }}' });
    expect(wrapped).toBeDefined();
  });

  test('handles null render context', async () => {
    const original = new Error('test');
    const wrapped = await wrapWithLog(original, { phase: 'render' });
    expect(wrapped).toBeDefined();
  });

  test('includes blockedContextKeys from config', async () => {
    const original = new Error('blocked');
    const wrapped = await wrapWithLog(original, {
      phase: 'render',
      blockedContextKeys: ['secret', 'password'],
    });
    expect(wrapped).toBeDefined();
  });
});
