import { describe, test, expect } from 'bun:test';
import { toConsoleString } from './to-console.ts';
import type { Warning } from '@nunjucks/error-catalog';

const baseWarning: Warning = { message: 'undefined reference', varName: 'foo' };

describe('toConsoleString — default verbosity', () => {
  test('defaults to full verbosity when omitted', () => {
    const output = toConsoleString(baseWarning);
    expect(output).toContain('Template Warning');
    expect(output).toContain('Message:');
    expect(output).toContain('Location:');
  });
});

describe('toConsoleString — simple verbosity', () => {
  test('renders the warning badge and titled variable name', () => {
    const output = toConsoleString(baseWarning, { verbosity: 'simple' });
    expect(output).toContain('[WARNING]');
    expect(output).toContain("Undefined variable 'foo'");
  });

  test('falls back to a generic title when varName is absent', () => {
    const unnamedWarning: Warning = { message: 'undefined reference' };
    expect(toConsoleString(unnamedWarning, { verbosity: 'simple' })).toContain(
      'Undefined variable',
    );
  });

  test('does not include a location at simple verbosity', () => {
    expect(toConsoleString(baseWarning, { verbosity: 'simple' })).not.toContain('at ');
  });
});

describe('toConsoleString — medium verbosity location', () => {
  test('renders a hyperlink when templateName is a file path', () => {
    const fileWarning: Warning = {
      message: 'undefined reference',
      varName: 'foo',
      lineno: 0,
      templateName: 'app.njk',
    };
    const output = toConsoleString(fileWarning, { verbosity: 'medium' });
    expect(output).toContain('\u001b]8;;vscode://file/app.njk:1:1');
  });

  test('renders a plain "at line N" when only a lineno is present', () => {
    const lineOnlyWarning: Warning = {
      message: 'undefined reference',
      varName: 'foo',
      lineno: 0,
    };
    const output = toConsoleString(lineOnlyWarning, { verbosity: 'medium' });
    expect(output).toContain('at line');
    expect(output).not.toContain('\u001b]8;;');
  });

  test('does not hyperlink a non-file templateName', () => {
    const nonFileWarning: Warning = {
      message: 'undefined reference',
      varName: 'foo',
      lineno: 0,
      templateName: 'memory:template',
    };
    const output = toConsoleString(nonFileWarning, { verbosity: 'medium' });
    expect(output).not.toContain('\u001b]8;;vscode://file/');
  });
});

describe('toConsoleString — full verbosity dev mode', () => {
  test('includes subject, code and undefinedMode only in dev mode', () => {
    const devWarning: Warning = {
      message: 'undefined reference',
      varName: 'foo',
      lineno: 2,
      templateName: 'app.njk',
      code: 'W100',
      undefinedMode: 'strict',
      subject: 'user.name',
    };
    const output = toConsoleString(devWarning, {
      verbosity: 'full',
      dev: true,
      version: '9.9.9',
      timestamp: '2024-01-01',
    });
    expect(output).toContain('Subject:');
    expect(output).toContain('user.name');
    expect(output).toContain('[W100]');
    expect(output).toContain('(strict)');
    expect(output).toContain('Nunjucks 9.9.9');
    expect(output).toContain('2024-01-01');
  });

  test('hides subject and undefinedMode outside dev mode', () => {
    const nonDevWarning: Warning = {
      message: 'undefined reference',
      varName: 'foo',
      lineno: 2,
      code: 'W100',
      undefinedMode: 'strict',
      subject: 'user.name',
    };
    const output = toConsoleString(nonDevWarning, { verbosity: 'full' });
    expect(output).not.toContain('Subject:');
    expect(output).not.toContain('(strict)');
    expect(output).toContain('[W100]');
  });

  test('omits the version when none is provided', () => {
    const output = toConsoleString(baseWarning, { verbosity: 'full' });
    expect(output).not.toContain('Nunjucks');
  });

  test('omits the timestamp footer segment when timestamp is absent', () => {
    const output = toConsoleString(baseWarning, { verbosity: 'full' });
    expect(output).not.toContain(' · ');
  });
});

describe('toConsoleString — getLocationString branches', () => {
  test('renders "line N" (zero-based offset) with lineno but no templateName', () => {
    const lineOnlyWarning: Warning = { message: 'u', varName: 'v', lineno: 4, lineBase: 'zero' };
    const output = toConsoleString(lineOnlyWarning, { verbosity: 'full' });
    expect(output).toContain('line 5');
  });

  test('renders the raw line number under one-based lineBase', () => {
    const oneBasedWarning: Warning = { message: 'u', varName: 'v', lineno: 5, lineBase: 'one' };
    const output = toConsoleString(oneBasedWarning, { verbosity: 'full' });
    expect(output).toContain('line 5');
  });

  test('renders "unknown" when neither lineno nor templateName is present', () => {
    const bareWarning: Warning = { message: 'u', varName: 'v' };
    const output = toConsoleString(bareWarning, { verbosity: 'full' });
    expect(output).toContain('unknown');
  });

  test('hyperlinks the location for a file templateName in full mode', () => {
    const fileWarning: Warning = {
      message: 'u',
      varName: 'v',
      lineno: 2,
      templateName: 'app.njk',
    };
    expect(toConsoleString(fileWarning, { verbosity: 'full' })).toContain(
      '\u001b]8;;vscode://file/',
    );
  });
});
