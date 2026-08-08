import { describe, test, expect } from 'bun:test';
import { compileToCode } from './compile-pipeline.ts';

describe('compileToCode', () => {
  test('produces JS string from simple template', () => {
    const code = compileToCode({ source: 'Hello {{ name }}', templateName: 'test', undefinedMode: 'chainable' });
    expect(typeof code).toBe('string');
    expect(code).toContain('async function root');
    expect(code).toContain('env, context, frame, runtime');
  });

  test('includes BLOCK_META_KEY in output for block templates', () => {
    const code = compileToCode({ source: '{% block content %}base{% endblock %}', templateName: 'test', undefinedMode: 'chainable' });
    expect(code).toContain('__blockMeta');
  });

  test('returns executable JS containing root function', () => {
    const code = compileToCode({ source: '{{ x }}', templateName: 'test', undefinedMode: 'chainable' });
    const result = new Function(`${code}; return root;`)() as { root: unknown };
    expect(typeof result.root).toBe('function');
  });

  test('handles undefined mode strict', () => {
    const code = compileToCode({ source: '{{ x }}', templateName: 'test', undefinedMode: 'strict' });
    expect(code).toContain('async function root');
  });

  test('handles empty template', () => {
    const code = compileToCode({ source: '', templateName: 'test', undefinedMode: 'chainable' });
    expect(code).toContain('async function root');
  });
});
