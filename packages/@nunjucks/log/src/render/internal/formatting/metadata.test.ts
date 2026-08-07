import { describe, test, expect } from 'bun:test';
import { createFormatterState } from './metadata.ts';
import type { NormalizedLogMetadata } from './metadata.ts';

const baseMeta: NormalizedLogMetadata = {
  lineno: 0, colno: 0, code: null, subject: null,
  phase: null, templateName: 't', lineBase: 'zero' as const,
};

describe('createFormatterState', () => {
  test('applies defaults when options empty', () => {
    const s = createFormatterState({ metadata: baseMeta, options: {} });
    expect(s.dev).toBe(false);
    expect(s.verbosity).toBe('full');
  });

  test('options.templatePath overrides metadata', () => {
    const s = createFormatterState({
      metadata: { ...baseMeta, templatePath: 'meta-path' },
      options: { templatePath: 'opts-path' },
    });
    expect(s.templatePath).toBe('opts-path');
  });

  test('metadata.templatePath used when options omits it', () => {
    const s = createFormatterState({
      metadata: { ...baseMeta, templatePath: 'meta-path' },
      options: {},
    });
    expect(s.templatePath).toBe('meta-path');
  });

  test('passes through metadata fields', () => {
    const s = createFormatterState({
      metadata: { ...baseMeta, templateName: 't.njk', lineno: 5, colno: 10, phase: 'render' },
      options: {},
    });
    expect(s.templateName).toBe('t.njk');
    expect(s.lineno).toBe(5);
    expect(s.colno).toBe(10);
    expect(s.phase).toBe('render');
  });
});
