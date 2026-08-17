import { describe, expect, test } from 'bun:test';
import type { Warning } from '@nunjucks/error-catalog';
import { injectWarningsScript } from './warning-script.ts';

const baseWarning: Warning = {
  message: 'Variable is undefined or null',
  code: 'UNDEFINED_VARIABLE',
  lineno: 2,
  colno: 7,
  templateName: '/views/home.njk',
  undefinedMode: 'debug',
};

describe('injectWarningsScript', () => {
  test('returns empty string for null, undefined, and empty arrays', () => {
    expect(injectWarningsScript(null)).toBe('');
    expect(injectWarningsScript(undefined)).toBe('');
    expect(injectWarningsScript([])).toBe('');
  });

  test('full verbosity: message, mode, basename location with +1 zero-based line, code', () => {
    expect(injectWarningsScript([baseWarning])).toContain(
      '[WARNING] Variable is undefined or null (debug) at home.njk:3:7 [UNDEFINED_VARIABLE]'
    );
  });

  test("lineBase 'one' keeps the raw line number", () => {
    expect(injectWarningsScript([{ ...baseWarning, lineBase: 'one' }])).toContain(
      'at home.njk:2:7'
    );
  });

  test('missing undefinedMode defaults to chainable (shared DEFAULT_UNDEFINED_MODE)', () => {
    const { undefinedMode: _omitted, ...withoutMode } = baseWarning;
    expect(injectWarningsScript([withoutMode])).toContain('(chainable)');
  });

  test('string warnings render the message-only form', () => {
    expect(injectWarningsScript(['legacy string'] as unknown as Warning[])).toContain(
      '[WARNING] legacy string'
    );
  });

  test('simple verbosity drops mode, location, and code', () => {
    const script = injectWarningsScript([baseWarning], { verbosity: 'simple' });
    expect(script).toContain('[WARNING] Variable is undefined or null');
    expect(script).not.toContain('home.njk');
    expect(script).not.toContain('[UNDEFINED_VARIABLE]');
  });

  test('medium verbosity keeps mode and location but drops the code', () => {
    const script = injectWarningsScript([baseWarning], { verbosity: 'medium' });
    expect(script).toContain('(debug) at home.njk:3:7');
    expect(script).not.toContain('[UNDEFINED_VARIABLE]');
  });

  test('bootstraps the global array once and emits one console.warn per warning', () => {
    const script = injectWarningsScript([baseWarning, 'second'] as unknown as Warning[]);
    expect(script.startsWith('<script>window.__nunjucks_warnings__=window.__nunjucks_warnings__||[];')).toBe(
      true
    );
    expect(script.endsWith('</script>')).toBe(true);
    expect(script.match(/console\.warn\('\[Nunjucks\]',/g)).toHaveLength(2);
  });

  test('escapes <, >, and & in the embedded JSON payload', () => {
    const script = injectWarningsScript([{ ...baseWarning, message: 'a <b> & c' }]);
    expect(script).toContain('a \\u003cb\\u003e \\u0026 c');
    expect(script).not.toContain('a <b>');
  });
});
