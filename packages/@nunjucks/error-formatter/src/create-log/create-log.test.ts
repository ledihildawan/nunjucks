import { describe, test, expect } from 'bun:test';
import { createLog, isTemplateError, prettifyError } from './create-log.ts';
import type { ErrorDefinitionEntry, ErrorContext, WarningContext } from './create-log.ts';

const def: ErrorDefinitionEntry = {
  name: 'TEST_ERR',
  message: 'something failed',
  pattern: /test/,
};
const errContext: ErrorContext = {
  lineno: 5,
  colno: 10,
  phase: 'render',
  templateName: 'foo.njk',
  lineBase: 'zero',
};
const noNameCtx: ErrorContext = {
  lineno: 1,
  colno: 1,
  phase: 'render',
  templateName: null,
  lineBase: 'zero',
};
const warnContext: WarningContext = {
  varName: 'x',
  lineno: 1,
  colno: 1,
  phase: 'render',
  templateName: null,
  lineBase: 'zero',
};

describe('createLog', () => {
  test('creates a TemplateError from a definition', () => {
    const err = createLog('error', { def, subject: 'mysubject', context: errContext });
    expect(isTemplateError(err)).toBe(true);
    expect(err.name).toBe('Template render error');
    expect(err.code).toBe('TEST_ERR');
    expect(err.message).toBe('something failed');
    expect(err.subject).toBe('mysubject');
    expect(err.lineno).toBe(5);
    expect(err.colno).toBe(10);
  });

  test('renders message function with params', () => {
    const fnDef: ErrorDefinitionEntry = {
      name: 'PARAM_ERR',
      message: (args) => `got ${(args as Record<string, string> | undefined)?.name ?? ''}`,
      pattern: /x/,
    };
    const err = createLog('error', {
      def: fnDef,
      params: { name: 'foo' },
      subject: null,
      context: noNameCtx,
    });
    expect(err.message).toBe('got foo');
  });

  test('creates a TemplateWarning from a definition', () => {
    const warn = createLog('warning', { def, subject: null, context: warnContext });
    expect(isTemplateError(warn)).toBe(false);
  });

  test('throws on an unknown log type', () => {
    expect(() => createLog('bad' as never, { def })).toThrow('Unknown log type');
  });

  test('falls back to legacy data when the input is not a definition', () => {
    const legacy = createLog('error', { def: { message: 'legacy fail' } as never });
    expect(isTemplateError(legacy)).toBe(true);
    expect(legacy.message).toBe('legacy fail');
  });
});

describe('isTemplateError', () => {
  test('true for createLog error output, false for plain Error and warnings', () => {
    expect(isTemplateError(createLog('error', { def, subject: null, context: errContext }))).toBe(
      true
    );
    expect(isTemplateError(new Error('plain'))).toBe(false);
    expect(isTemplateError(null)).toBe(false);
    expect(
      isTemplateError(createLog('warning', { def, subject: null, context: warnContext }))
    ).toBe(false);
  });
});

describe('prettifyError', () => {
  test('applies the path as templateName when none is set (with internals)', () => {
    const source = createLog('error', { def, subject: null, context: noNameCtx });
    const pretty = prettifyError({ err: source, path: 'template.njk', withInternals: true });
    expect(isTemplateError(pretty)).toBe(true);
    expect(pretty.templateName).toBe('template.njk');
  });

  test('strips internals but preserves the code and message', () => {
    const source = createLog('error', { def, subject: null, context: noNameCtx });
    const pretty = prettifyError({ err: source, path: 'template.njk', withInternals: false });
    expect(pretty.code).toBe('TEST_ERR');
    expect(pretty.message).toBe('something failed');
  });
});
