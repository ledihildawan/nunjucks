import { describe, expect, test } from 'bun:test';
import type { ErrorContext } from './create-log.ts';
import { createLog } from './create-log.ts';
import { formatError } from './format-error.ts';

const def = { name: 'FMT_TEST_ERR', message: 'format boom', pattern: /boom/ };
const errContext: ErrorContext = {
  lineno: 2,
  colno: 7,
  phase: 'render',
  templateName: 'fmt.njk',
  lineBase: 'zero',
};

describe('formatError', () => {
  test('renders the bare message at simple verbosity in text format', () => {
    const err = createLog('error', { def, subject: null, context: errContext });
    expect(formatError(err, { format: 'text', verbosity: 'simple', dev: true })).toBe(
      'format boom'
    );
  });

  test('full text output carries the Error severity label for plain errors', () => {
    const err = createLog('error', { def, subject: null, context: errContext });
    const output = formatError(err, { format: 'text', dev: true });
    expect(output).toContain('Error: format boom');
  });

  test('warning-severity errors render with the Warning label', () => {
    const err = createLog('error', {
      def: { ...def, severity: 'warning' },
      subject: null,
      context: errContext,
    });
    const output = formatError(err, { format: 'text', dev: true });
    expect(output).toContain('Warning: format boom');
  });
});
