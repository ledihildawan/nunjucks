import { describe, test, expect } from 'bun:test';
import { getDefaultConfig } from './global.ts';

describe('getDefaultConfig', () => {
  test('applies default security and template options', () => {
    const cfg = getDefaultConfig();
    expect(cfg.sandbox).toBe(false);
    expect(cfg.strictMode).toBe(false);
    expect(cfg.autoescape).toBe(true);
    expect(cfg.trimBlocks).toBe(false);
    expect(cfg.lstripBlocks).toBe(false);
    expect(cfg.undefined).toBe('default');
    expect(cfg.sandboxMode).toBe('blocklist');
    expect(cfg.sandboxEnvironment).toBe('auto');
    expect(cfg.executionTimeout).toBe(0);
    expect(cfg.maxTemplateSize).toBe(0);
    expect(cfg.views).toBeNull();
    expect(cfg.blockedContextKeys).toBeNull();
  });

  test('exposes sandboxed builtins via globals', () => {
    const cfg = getDefaultConfig();
    const globals = cfg.globals as Record<string, unknown>;
    expect('Math' in globals).toBe(true);
    expect('JSON' in globals).toBe(true);
    expect('Object' in globals).toBe(true);
    const math = (cfg.globals as Record<string, { abs: unknown }>)['Math'];
    expect(typeof math?.abs).toBe('function');
  });

  test('defaults filters and dompurify to frozen empty objects', () => {
    const cfg = getDefaultConfig();
    expect(Object.isFrozen(cfg.filters)).toBe(true);
    expect(Object.isFrozen(cfg.dompurify)).toBe(true);
    expect(Object.keys(cfg.filters)).toHaveLength(0);
  });

  test('applies a provided filter bundle', () => {
    const filters = { upper: (s: string) => s.toUpperCase() };
    const dompurify = { ALLOWED_TAGS: ['b'] };
    const cfg = getDefaultConfig({ filters, dompurify });
    expect(cfg.filters).toBe(filters);
    expect(cfg.dompurify).toBe(dompurify);
  });
});
