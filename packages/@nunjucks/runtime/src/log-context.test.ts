import { describe, expect, test } from 'bun:test';
import type { ErrorDefinitionEntry, TemplateError } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import type { Phase } from '@nunjucks/shared';
import { getLogContext, throwRuntimeError } from './log-context.ts';

const sampleDef: ErrorDefinitionEntry = {
  name: 'TEST_RUNTIME_ERR',
  message: "Variable '{name}' is missing",
  pattern: /^Variable '([^']+)' is missing$/u,
  causes: ['The variable was not passed in the render context'],
  fixCode: "{{ {name} |> default('fallback') }}",
};

const placeholderFreeDef: ErrorDefinitionEntry = {
  name: 'STATIC_ERR',
  message: 'something broke',
  pattern: /^something broke$/u,
};

const resolveFunctionMessage = (args?: Record<string, string> | string[]): string => {
  if (args == null || Array.isArray(args)) {
    return 'got ';
  }
  return `got ${args.k ?? ''}`;
};

const functionMessageDef: ErrorDefinitionEntry = {
  name: 'FN_MSG_ERR',
  message: resolveFunctionMessage,
  pattern: /^got .*$/u,
};

describe('getLogContext', () => {
  test('returns the default context shape when value has no logContext', () => {
    expect(getLogContext(undefined)).toEqual({
      templateName: null,
      phase: 'render',
      renderContext: null,
    });
  });

  test('returns the embedded logContext by reference, preserving every field', () => {
    const embeddedLogContext = {
      templateName: 'page.njk',
      phase: 'compile' as Phase,
      renderContext: { user: 'alice' },
    };
    expect(getLogContext({ logContext: embeddedLogContext })).toBe(embeddedLogContext);
  });

  test('preserves a non-default embedded phase', () => {
    const embeddedLogContext = { templateName: null, phase: 'load' as Phase, renderContext: null };
    expect(getLogContext({ logContext: embeddedLogContext }).phase).toBe('load');
  });
});

describe('hasLogContext (module-private — exercised via getLogContext)', () => {
  const embeddedLogContext = {
    templateName: 'carrier.njk',
    phase: 'render' as Phase,
    renderContext: null,
  };

  const carrierCases: ReadonlyArray<{ label: string; carrier: { logContext: typeof embeddedLogContext } & Record<string, unknown> }> = [
    { label: 'object whose only key is logContext', carrier: { logContext: embeddedLogContext } },
    { label: 'object with logContext alongside other keys', carrier: { logContext: embeddedLogContext, extra: 1 } },
  ];

  test('returns true for carrier values, yielding the embedded logContext', () => {
    carrierCases.forEach(({ label, carrier }) => {
      expect(getLogContext(carrier), label).toBe(embeddedLogContext);
    });
  });

  const nonCarrierCases: ReadonlyArray<{ label: string; value: unknown }> = [
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
    { label: 'empty object', value: {} },
    { label: 'object without a logContext key', value: { other: 1 } },
    { label: 'string primitive', value: 'hello' },
    { label: 'number primitive', value: 42 },
    { label: 'boolean primitive', value: true },
    { label: 'array', value: [1, 2, 3] },
  ];

  test('returns false for non-carrier values, falling back to the default shape', () => {
    nonCarrierCases.forEach(({ label, value }) => {
      expect(getLogContext(value), label).toEqual({
        templateName: null,
        phase: 'render',
        renderContext: null,
      });
    });
  });

  test('checks key presence only: a present-but-null logContext is still detected', () => {
    expect(getLogContext({ logContext: null }) == null).toBe(true);
  });
});

describe('throwRuntimeError', () => {
  test('throws a TemplateError whose code is the def name and whose name is fixed', () => {
    try {
      throwRuntimeError(sampleDef, { self: null, params: { name: 'foo' } });
      throw new Error('throwRuntimeError did not throw');
    } catch (error) {
      const templateError = error as TemplateError;
      expect(templateError.code).toBe('TEST_RUNTIME_ERR');
      expect(templateError.name).toBe('Template render error');
    }
  });

  test('interpolates params into the def message', () => {
    try {
      throwRuntimeError(sampleDef, { self: null, params: { name: 'bar' } });
      throw new Error('throwRuntimeError did not throw');
    } catch (error) {
      expect((error as TemplateError).message).toBe("Variable 'bar' is missing");
    }
  });

  test('forwards the subject onto the error', () => {
    try {
      throwRuntimeError(sampleDef, { self: null, params: { name: 'x' }, subject: 'mySubject' });
      throw new Error('throwRuntimeError did not throw');
    } catch (error) {
      expect((error as TemplateError).subject).toBe('mySubject');
    }
  });

  test('subject defaults to null when omitted', () => {
    try {
      throwRuntimeError(sampleDef, { self: null, params: { name: 'x' } });
      throw new Error('throwRuntimeError did not throw');
    } catch (error) {
      expect((error as TemplateError).subject).toBeNull();
    }
  });

  test('passes lineno and colno into the error context', () => {
    try {
      throwRuntimeError(sampleDef, { self: null, lineno: 17, colno: 4, params: { name: 'x' } });
      throw new Error('throwRuntimeError did not throw');
    } catch (error) {
      const templateError = error as TemplateError;
      expect(templateError.lineno).toBe(17);
      expect(templateError.colno).toBe(4);
    }
  });

  test('lineno and colno default to null when omitted', () => {
    try {
      throwRuntimeError(sampleDef, { self: null, params: { name: 'x' } });
      throw new Error('throwRuntimeError did not throw');
    } catch (error) {
      const templateError = error as TemplateError;
      expect(templateError.lineno).toBeNull();
      expect(templateError.colno).toBeNull();
    }
  });

  test('uses the "render" phase, "inline" templateName and "zero" lineBase when no logContext is present', () => {
    try {
      throwRuntimeError(sampleDef, { self: null, params: { name: 'x' } });
      throw new Error('throwRuntimeError did not throw');
    } catch (error) {
      const templateError = error as TemplateError;
      expect(templateError.phase).toBe('render');
      expect(templateError.templateName).toBe('inline');
      expect(templateError.lineBase).toBe('zero');
    }
  });

  test('inherits phase and templateName from the embedded logContext', () => {
    const carrier = {
      logContext: { templateName: 'embedded.njk', phase: 'compile' as Phase, renderContext: null },
    };
    try {
      throwRuntimeError(sampleDef, { self: carrier, params: { name: 'x' } });
      throw new Error('throwRuntimeError did not throw');
    } catch (error) {
      const templateError = error as TemplateError;
      expect(templateError.phase).toBe('compile');
      expect(templateError.templateName).toBe('embedded.njk');
    }
  });

  test('explicit templateName overrides the embedded logContext templateName', () => {
    const carrier = {
      logContext: { templateName: 'embedded.njk', phase: 'render' as Phase, renderContext: null },
    };
    try {
      throwRuntimeError(sampleDef, { self: carrier, templateName: 'override.njk', params: { name: 'x' } });
      throw new Error('throwRuntimeError did not throw');
    } catch (error) {
      expect((error as TemplateError).templateName).toBe('override.njk');
    }
  });

  test('falls back to "inline" when the embedded logContext has a null templateName', () => {
    const carrier = {
      logContext: { templateName: null, phase: 'render' as Phase, renderContext: null },
    };
    try {
      throwRuntimeError(sampleDef, { self: carrier, params: { name: 'x' } });
      throw new Error('throwRuntimeError did not throw');
    } catch (error) {
      expect((error as TemplateError).templateName).toBe('inline');
    }
  });

  test('supports a function-typed def message resolved with params', () => {
    try {
      throwRuntimeError(functionMessageDef, { self: null, params: { k: 'zzz' } });
      throw new Error('throwRuntimeError did not throw');
    } catch (error) {
      const templateError = error as TemplateError;
      expect(templateError.code).toBe('FN_MSG_ERR');
      expect(templateError.message).toBe('got zzz');
    }
  });

  test('defaults omitted params to an empty object so placeholder-free messages still resolve', () => {
    try {
      throwRuntimeError(placeholderFreeDef, { self: null });
      throw new Error('throwRuntimeError did not throw');
    } catch (error) {
      expect((error as TemplateError).message).toBe('something broke');
    }
  });

  test('is captured by the toThrow matcher', () => {
    expect(() => throwRuntimeError(sampleDef, { self: null, params: { name: 'x' } })).toThrow();
  });

  test('works against a real catalog definition (UNDEFINED_VARIABLE)', () => {
    try {
      throwRuntimeError(ERROR_DEFINITIONS.UNDEFINED_VARIABLE, {
        self: null,
        params: { name: 'user.name' },
        subject: 'user.name',
      });
      throw new Error('throwRuntimeError did not throw');
    } catch (error) {
      const templateError = error as TemplateError;
      expect(templateError.code).toBe('UNDEFINED_VARIABLE');
      expect(templateError.message).toContain('user.name');
      expect(templateError.subject).toBe('user.name');
    }
  });
});
