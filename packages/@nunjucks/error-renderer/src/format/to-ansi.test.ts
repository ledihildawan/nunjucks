import { describe, test, expect } from 'bun:test';
import { toAnsi } from './to-ansi.ts';
import type { AnsiOptions } from './to-ansi.ts';
import type { ErrorLike } from '@nunjucks/error-catalog';

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
