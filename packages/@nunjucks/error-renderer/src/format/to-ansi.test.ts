import { describe, expect, test } from 'bun:test';
import type { ErrorLike } from '@nunjucks/error-catalog';
import type { AnsiOptions } from './to-ansi.ts';
import { toAnsi } from './to-ansi.ts';

const nullishErrorInputs: readonly unknown[] = [null, undefined];

describe('toAnsi — null/undefined error', () => {
  nullishErrorInputs.forEach((errorInput) => {
    test(`returns empty string for ${String(errorInput)} error`, () => {
      expect(toAnsi(errorInput)).toBe('');
    });
  });
});

describe('toAnsi — default verbosity', () => {
  test('defaults to full verbosity when omitted', () => {
    const fullError: ErrorLike = { message: 'boom' };
    const output = toAnsi(fullError);
    expect(output.length).toBeGreaterThan(0);
    expect(output).toContain('boom');
  });
});

describe('toAnsi — simple verbosity short-circuit', () => {
  test('returns only the plain message at simple verbosity', () => {
    const simpleError: ErrorLike = { message: 'boom' };
    expect(toAnsi(simpleError, { verbosity: 'simple' })).toBe('boom');
  });

  test('simple verbosity skips ANSI styling', () => {
    const simpleError: ErrorLike = { message: 'boom' };
    expect(toAnsi(simpleError, { verbosity: 'simple' })).not.toContain('\u001b');
  });
});

describe('toAnsi — medium verbosity', () => {
  test('renders a hyperlink location for a file path at zero-based line', () => {
    const mediumError: ErrorLike = { message: 'boom', lineno: 0, lineBase: 'zero' };
    const output = toAnsi(mediumError, { verbosity: 'medium', templatePath: 'app.njk' });
    expect(output).toContain('vscode://file/app.njk:1:1');
    expect(output).toContain('boom');
  });

  test('appends the first-cause hint after the location', () => {
    const mediumError: ErrorLike = { message: 'boom', lineno: 0, lineBase: 'zero' };
    const output = toAnsi(mediumError, { verbosity: 'medium', templatePath: 'app.njk' });
    expect(output).toContain('Check template syntax');
  });

  test('honors one-based lineBase in the displayed location', () => {
    const oneBasedError: ErrorLike = { message: 'boom', lineno: 7, lineBase: 'one' };
    const output = toAnsi(oneBasedError, { verbosity: 'medium', templatePath: 'app.njk' });
    expect(output).toContain('app.njk:7:1');
  });
});

describe('toAnsi — full verbosity', () => {
  test('renders a styled stack trace section for the error', () => {
    const fullError: ErrorLike = {
      message: 'boom',
      stack: 'Error: boom\n    at foo (bar.njk:10:5)',
    };
    const output = toAnsi(fullError, { verbosity: 'full' });
    expect(output).toContain('Stack Trace:');
    expect(output).toContain('bar.njk');
  });

  test('passes through renderContext to the full formatter', () => {
    const fullError: ErrorLike = {
      message: 'boom',
      renderContext: { user: 'alice' },
    };
    const output = toAnsi(fullError, {
      verbosity: 'full',
      renderContext: { user: 'alice' },
    });
    expect(output.length).toBeGreaterThan(0);
  });

  test('accepts custom ide option without throwing', () => {
    const customIdeOptions: AnsiOptions = {
      verbosity: 'medium',
      templatePath: 'app.njk',
      ide: 'custom',
    };
    const errorWithLoc: ErrorLike = { message: 'boom', lineno: 1, lineBase: 'one' };
    expect(() => toAnsi(errorWithLoc, customIdeOptions)).not.toThrow();
  });
});

describe('toAnsi — terminal control sanitization', () => {
  // WHY: only the control characters are stripped — the inert '[2J' text may remain.
  test('strips ESC/BEL sequences from the error message at simple verbosity', () => {
    const malicious: ErrorLike = { message: 'boom\x1b[2J\x07' };
    expect(toAnsi(malicious, { verbosity: 'simple' })).toBe('boom[2J');
  });

  test('strips ESC/BEL sequences from the error message at full verbosity', () => {
    const malicious: ErrorLike = {
      message: 'boom\x1b[2J\x07',
      stack: 'Error: boom\n    at foo (bar.njk:1:1)',
    };
    const output = toAnsi(malicious);
    expect(output).toContain('boom');
    expect(output).not.toContain('\x1b[2J');
    expect(output).not.toContain('\x07');
  });

  test('strips ESC from template source-trace lines', () => {
    const output = toAnsi(
      { message: 'boom' },
      {
        sourceTrace: {
          lines: [{ number: 1, content: '{{ ev\x1b[2Jal }}', isError: true }],
          caret: null,
          displayLine: 1,
          displayCol: 1,
          resolvedPath: 'app.njk',
        },
      }
    );
    expect(output).toContain('Source Trace:');
    // WHY: the highlighter interleaves its own color codes between characters, so
    // assert on the absent ESC sequence rather than the plain text.
    expect(output).not.toContain('\x1b[2J');
  });

  test('strips ESC from render-context values', () => {
    const output = toAnsi({ message: 'boom' }, { renderContext: { user: 'ev\x1b[2Jil' } });
    expect(output).toContain('"ev[2Jil"');
    expect(output).not.toContain('\x1b[2J');
  });

  test('strips BEL from the template path in the medium one-liner', () => {
    const output = toAnsi(
      { message: 'boom', templateName: 'app\x07.njk' },
      { verbosity: 'medium', templatePath: 'app\x07.njk' }
    );
    expect(output).toContain('app.njk');
    expect(output).not.toContain('\x07');
  });
});
