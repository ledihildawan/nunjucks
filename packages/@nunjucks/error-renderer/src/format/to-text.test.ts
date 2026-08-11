import { describe, test, expect } from 'bun:test';
import { toText } from './to-text.ts';
import type { ErrorLike } from '@nunjucks/error-catalog';

const nullishErrorInputs: readonly unknown[] = [null, undefined];

nullishErrorInputs.forEach((errorInput) => {
  test(`returns empty string for ${String(errorInput)} error`, () => {
    expect(toText(errorInput)).toBe('');
  });
});

describe('toText — default verbosity', () => {
  test('defaults to full verbosity when omitted', () => {
    const fullError: ErrorLike = { message: 'boom' };
    expect(toText(fullError)).toContain('Error: boom');
    expect(toText(fullError)).toContain('Possible Causes:');
  });
});

describe('toText — simple verbosity', () => {
  test('returns only the message at simple verbosity', () => {
    const simpleError: ErrorLike = { message: 'boom' };
    expect(toText(simpleError, { verbosity: 'simple' })).toBe('boom');
  });

  test('strips an embedded stack trace from the simple message', () => {
    const errorWithStackInMessage: ErrorLike = {
      message: 'real failure\n    at foo (bar.njk:1:1)',
    };
    expect(toText(errorWithStackInMessage, { verbosity: 'simple' })).toBe('real failure');
  });
});

describe('toText — severity labels', () => {
  type SeverityCase = {
    readonly severity: ErrorLike['severity'];
    readonly expectedLabel: string;
  };
  const severityCases: readonly SeverityCase[] = [
    { severity: 'error', expectedLabel: 'Error:' },
    { severity: 'warning', expectedLabel: 'Warning:' },
    { severity: 'info', expectedLabel: 'Info:' },
    { severity: undefined, expectedLabel: 'Error:' },
  ];

  severityCases.forEach(({ severity, expectedLabel }) => {
    test(`severity ${severity ?? 'undefined'} renders label "${expectedLabel}"`, () => {
      const errorWithSeverity: ErrorLike = { message: 'boom', severity };
      expect(toText(errorWithSeverity, { verbosity: 'full' })).toContain(`${expectedLabel} boom`);
    });
  });
});

describe('toText — medium verbosity with location', () => {
  test('renders short location string and first-cause hint at zero-based line', () => {
    const mediumError: ErrorLike = {
      message: 'boom',
      lineno: 0,
      colno: 0,
      lineBase: 'zero',
    };
    expect(toText(mediumError, { verbosity: 'medium', templatePath: 'app.njk' })).toBe(
      'Error: boom at app.njk:1:1\nCheck template syntax',
    );
  });

  test('honors one-based lineBase for the displayed line', () => {
    const oneBasedError: ErrorLike = { message: 'boom', lineno: 4, lineBase: 'one' };
    expect(toText(oneBasedError, { verbosity: 'medium', templatePath: 'app.njk' })).toBe(
      'Error: boom at app.njk:4:1\nCheck template syntax',
    );
  });

  test('derives location from options rather than the error object', () => {
    const errorWithoutLoc: ErrorLike = { message: 'boom' };
    expect(toText(errorWithoutLoc, { verbosity: 'medium', lineno: 2, colno: 5 })).toBe(
      'Error: boom at unknown:3:6\nCheck template syntax',
    );
  });

  test('does not render the "Possible Causes" section header at medium verbosity', () => {
    const mediumError: ErrorLike = { message: 'boom', lineno: 0, lineBase: 'zero' };
    expect(toText(mediumError, { verbosity: 'medium', templatePath: 'app.njk' })).not.toContain(
      'Possible Causes:',
    );
  });
});

describe('toText — medium verbosity without location falls through to full', () => {
  test('medium with no location options produces the full output', () => {
    const errorNoLoc: ErrorLike = { message: 'boom' };
    const output = toText(errorNoLoc, { verbosity: 'medium' });
    expect(output).toContain('Possible Causes:');
    expect(output).toContain('Suggested Fix:');
    expect(output).not.toContain(' at ');
  });
});

describe('toText — full verbosity causes and fix', () => {
  test('renders Possible Causes and Suggested Fix sections', () => {
    const fullError: ErrorLike = { message: 'boom' };
    const output = toText(fullError, { verbosity: 'full' });
    expect(output).toContain('Possible Causes:');
    expect(output).toContain('Suggested Fix:');
  });

  test('strips markdown bold/code markers from cause bullets', () => {
    const fullError: ErrorLike = { message: 'boom' };
    const output = toText(fullError, { verbosity: 'full' });
    expect(output).toContain('Check template syntax');
    expect(output).not.toContain('**syntax**');
  });
});

describe('toText — full verbosity stack trace', () => {
  test('omits the stack section when error has no stack', () => {
    const errorNoStack: ErrorLike = { message: 'boom', severity: 'info' };
    expect(toText(errorNoStack)).not.toContain('at foo');
  });

  test('formats named stack frames as "at fn (path:line)"', () => {
    const errorWithNamedStack: ErrorLike = {
      message: 'boom',
      severity: 'warning',
      stack: 'Error: boom\n    at foo (bar.njk:10:5)',
    };
    expect(toText(errorWithNamedStack)).toContain('  at foo (bar.njk:10)');
  });

  test('renders raw text for stack frames without a parsed location', () => {
    const errorWithRawStack: ErrorLike = {
      message: 'boom',
      stack: 'Error: boom\n    at somewhere anonymous',
    };
    expect(toText(errorWithRawStack)).toContain('  at somewhere anonymous');
  });
});
