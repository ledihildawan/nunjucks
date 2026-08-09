import { describe, test, expect } from 'bun:test';
import { createErrorFromDef, createWarningFromDef } from './create-log-error.ts';
import type { ErrorDefinitionEntry, NormalizedErrorContext, NormalizedWarningContext } from './create-log-types.ts';
import { TEMPLATE_ERROR } from './create-log-types.ts';

const def: ErrorDefinitionEntry = { name: 'MY_CODE', message: 'something broke', pattern: /x/ };
const normErr: NormalizedErrorContext = { lineno: 3, colno: 7, phase: 'render', templateName: 't.njk', lineBase: 'zero', timestamp: null };
const normWarn: NormalizedWarningContext = { lineno: 1, colno: 1, phase: 'render', templateName: null, lineBase: 'zero', timestamp: null, varName: 'x', undefinedMode: 'chainable' };

describe('createErrorFromDef', () => {
  test('builds a TemplateError carrying the definition identity and marker', () => {
    const err = createErrorFromDef(def, undefined, normErr, undefined, 'subj');
    expect(err.name).toBe('Template render error');
    expect(err.code).toBe('MY_CODE');
    expect(err.message).toBe('something broke');
    expect(err.subject).toBe('subj');
    expect(err.lineno).toBe(3);
    expect(err.colno).toBe(7);
    expect(err[TEMPLATE_ERROR]).toBe(true);
  });

  test('templatePath mirrors the normalised templateName', () => {
    const err = createErrorFromDef(def, undefined, normErr, undefined, null);
    expect(err.templatePath).toBe('t.njk');
  });

  test('resolves the message function with params', () => {
    const fnDef: ErrorDefinitionEntry = { name: 'P', message: (a) => `v=${(a as Record<string, string>)?.k ?? ''}`, pattern: /./ };
    expect(createErrorFromDef(fnDef, { k: '1' }, normErr, undefined, null).message).toBe('v=1');
  });

  test('attaches optional causes/fixCode/documentationUrl/severity when the definition provides them', () => {
    const richDef: ErrorDefinitionEntry = {
      name: 'RICH', message: 'm', pattern: /./,
      causes: ['c1', 'c2'], fixCode: 'fc', fixComment: 'fx', documentationUrl: 'https://x', severity: 'warning',
    };
    const err = createErrorFromDef(richDef, undefined, normErr, undefined, null);
    expect(err.causes).toEqual(['c1', 'c2']);
    expect(err.fixCode).toBe('fc');
    expect(err.fixComment).toBe('fx');
    expect(err.documentationUrl).toBe('https://x');
    expect(err.severity).toBe('warning');
  });

  test('toJSON serialises the structural fields', () => {
    const err = createErrorFromDef(def, undefined, normErr, undefined, 'subj');
    const json = err.toJSON?.();
    expect(json?.code).toBe('MY_CODE');
    expect(json?.message).toBe('something broke');
    expect(json?.lineno).toBe(3);
  });
});

describe('createWarningFromDef', () => {
  test('builds a TemplateWarning with resolved message, code, and warning-specific fields', () => {
    const warn = createWarningFromDef(def, undefined, normWarn, null);
    expect(warn.message).toBe('something broke');
    expect(warn.code).toBe('MY_CODE');
    expect(warn.varName).toBe('x');
    expect(warn.undefinedMode).toBe('chainable');
  });

  test('omits causes/fixCode when the definition has none', () => {
    const warn = createWarningFromDef(def, undefined, normWarn, null);
    expect(warn.causes).toBeUndefined();
    expect(warn.fixCode).toBeUndefined();
  });
});
