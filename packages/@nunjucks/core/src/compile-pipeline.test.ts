import { describe, expect, test } from 'bun:test';
import { isOk } from '@nunjucks/lib';
import { compileToCode } from './compile-pipeline.ts';

const unwrapCode = (result: ReturnType<typeof compileToCode>): string => {
  if (!isOk(result)) {
    throw result.error;
  }
  return result.value;
};

describe('compileToCode', () => {
  test('produces JS string from simple template', () => {
    const code = unwrapCode(
      compileToCode({
        source: 'Hello {{ name }}',
        templateName: 'test',
        undefinedMode: 'chainable',
      })
    );
    expect(typeof code).toBe('string');
    expect(code).toContain('async function* root');
    expect(code).toContain('env, context, frame, runtime');
  });

  test('includes BLOCK_META_KEY in output for block templates', () => {
    const code = unwrapCode(
      compileToCode({
        source: '{% block content %}base{% endblock %}',
        templateName: 'test',
        undefinedMode: 'chainable',
      })
    );
    expect(code).toContain('__blockMeta');
  });

  test('returns executable JS containing root function', () => {
    const code = unwrapCode(
      compileToCode({ source: '{{ x }}', templateName: 'test', undefinedMode: 'chainable' })
    );
    const result = new Function(`${code}; return root;`)() as { root: unknown };
    expect(typeof result.root).toBe('function');
  });

  test('handles undefined mode strict', () => {
    const code = unwrapCode(
      compileToCode({ source: '{{ x }}', templateName: 'test', undefinedMode: 'strict' })
    );
    expect(code).toContain('async function* root');
  });

  test('handles empty template', () => {
    const code = unwrapCode(
      compileToCode({ source: '', templateName: 'test', undefinedMode: 'chainable' })
    );
    expect(code).toContain('async function* root');
  });

  test('returns Err for unparseable template', () => {
    const result = compileToCode({
      source: '{{ unclosed',
      templateName: 'test',
      undefinedMode: 'chainable',
    });
    expect(isOk(result)).toBe(false);
  });
});

describe('expressionSecurity', () => {
  test('rejects __proto__ symbol access when expressionSecurity is enabled', () => {
    const result = compileToCode({
      source: '{{ x.__proto__ }}',
      templateName: 'test',
      undefinedMode: 'chainable',
      expressionSecurity: { blockedPropertyPatterns: [/^__/, /constructor$/, /prototype$/] },
    });
    expect(isOk(result)).toBe(false);
  });

  test('rejects constructor symbol when expressionSecurity is enabled', () => {
    const result = compileToCode({
      source: '{{ x.constructor }}',
      templateName: 'test',
      undefinedMode: 'chainable',
      expressionSecurity: { blockedPropertyPatterns: [/^__/, /constructor$/, /prototype$/] },
    });
    expect(isOk(result)).toBe(false);
  });

  test('rejects eval call when expressionSecurity is enabled', () => {
    const result = compileToCode({
      source: '{{ eval("1") }}',
      templateName: 'test',
      undefinedMode: 'chainable',
      expressionSecurity: { blockedPropertyPatterns: [/^__/, /constructor$/, /prototype$/] },
    });
    expect(isOk(result)).toBe(false);
  });

  test('allows safe templates when expressionSecurity is enabled', () => {
    const code = unwrapCode(
      compileToCode({
        source: '{{ user.name }}',
        templateName: 'test',
        undefinedMode: 'chainable',
        expressionSecurity: { blockedPropertyPatterns: [/^__/, /constructor$/, /prototype$/] },
      })
    );
    expect(typeof code).toBe('string');
    expect(code).toContain('async function* root');
  });

  test('parseOpts.security is overridden by top-level expressionSecurity option', () => {
    const result = compileToCode({
      source: '{{ x.__proto__ }}',
      templateName: 'test',
      undefinedMode: 'chainable',
      expressionSecurity: { blockedPropertyPatterns: [/^__/, /constructor$/, /prototype$/] },
      parseOpts: { security: null },
    });
    expect(isOk(result)).toBe(false);
  });
});
