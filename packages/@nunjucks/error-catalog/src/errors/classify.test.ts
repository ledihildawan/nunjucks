import { describe, expect, test } from 'bun:test';
import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { classifyFromError } from './classify.ts';
import type { ErrorDefinition } from './types.ts';

// WHY: local TemplateError-shaped fixture avoids a test-only dependency on @nunjucks/error-formatter (cycle + undeclared dep)
interface LocalTemplateError {
  subject: string | null;
  message: string;
  causes: readonly string[];
  fixCode: string | null;
}

const resolveMessage = (
  message: ErrorDefinition['message'],
  params: Record<string, string>
): string =>
  typeof message === 'function'
    ? message(params)
    : message.replaceAll(/\{(\w+)\}/gu, (_, key: string) => params[key] ?? '');

const createLocalTemplateError = ({
  def,
  params,
  subject,
}: {
  def: ErrorDefinition;
  params: Record<string, string>;
  subject: string;
}): LocalTemplateError => ({
  subject,
  message: resolveMessage(def.message, params),
  causes: [...def.causes],
  fixCode: def.fixCode ?? null,
});

describe('error messages - sample output', () => {
  test('UNDEFINED_VARIABLE message includes subject', () => {
    const err = createLocalTemplateError({
      def: ERROR_DEFINITIONS.UNDEFINED_VARIABLE,
      params: { name: 'user.something' },
      subject: 'user.something',
    });
    expect(err.subject).toBe('user.something');
    expect(err.message).toContain('user.something');
    expect(err.causes!.length).toBeGreaterThan(0);
    expect(err.fixCode).toBeTruthy();
  });

  test('NULL_VALUE error handles nested access', () => {
    const err = createLocalTemplateError({
      def: ERROR_DEFINITIONS.NULL_VALUE,
      params: { accessPath: 'name', parent: 'user', state: 'null' },
      subject: 'name',
    });
    expect(err.message).toContain('name');
    expect(err.message).toContain('user');
  });

  test('FILE_NOT_FOUND has helpful message', () => {
    const err = createLocalTemplateError({
      def: ERROR_DEFINITIONS.FILE_NOT_FOUND,
      params: { path: 'missing.njk' },
      subject: 'missing.njk',
    });
    expect(err.message).toContain('missing.njk');
    expect(err.fixCode).toBeTruthy();
  });

  test('UNDEFINED_FILTER has helpful fix', () => {
    const err = createLocalTemplateError({
      def: ERROR_DEFINITIONS.UNDEFINED_FILTER,
      params: { name: 'myFilter' },
      subject: 'myFilter',
    });
    expect(err.message).toContain('myFilter');
    expect(err.fixCode).toContain('filters');
  });
});

describe('classify', () => {
  test('classification substitutes placeholders in causes', () => {
    const cls = classifyFromError({
      code: 'UNDEFINED_PROPERTY',
      subject: 'something',
      message: "Property 'something' not found in 'user'",
    });

    expect(cls.causes.some((c) => c.includes('something'))).toBe(true);
    expect(cls.causes.some((c) => c.includes('user'))).toBe(true);
  });

  test('classification substitutes placeholders in fixCode', () => {
    const cls = classifyFromError({
      code: 'UNDEFINED_FILTER',
      subject: 'myFilter',
      message: "Filter 'myFilter' is not defined",
    });

    expect(cls.fixCode).toContain('myFilter');
    expect(cls.fixCode).not.toContain('{subject}');
  });

  test('NULL_VALUE classification substitutes parent', () => {
    const cls = classifyFromError({
      code: 'NULL_VALUE',
      message: "Cannot access 'name' on null 'user'",
    });

    expect(cls.causes.some((c) => c.includes('user'))).toBe(true);
  });

  test('UNDEFINED_VARIABLE classification substitutes subject', () => {
    const cls = classifyFromError({
      code: 'UNDEFINED_VARIABLE',
      message: "Variable 'foo' is not defined",
    });

    expect(cls.causes.some((c) => c.includes('foo'))).toBe(true);
    expect(cls.fixCode).toContain('foo');
  });

  test('oversized message skips regex classification but keeps code-based classification', () => {
    const cls = classifyFromError({
      code: 'UNDEFINED_VARIABLE',
      message: `Variable '${'x'.repeat(5000)}' is not defined`,
    });

    expect(cls.category).toBe(ERROR_DEFINITIONS.UNDEFINED_VARIABLE.category);
  });

  test('oversized message without a code falls back to the default classification', () => {
    const cls = classifyFromError({
      message: `Cannot access 'name' on null '${'x'.repeat(5000)}'`,
    });

    expect(cls.category).toBe('unknown');
  });

  test('classifies a NULL_VALUE-shaped message exactly at the 4096-char boundary', () => {
    const prefix = "Cannot access 'name' on null '";
    const message = `${prefix}${'x'.repeat(4096 - prefix.length - 1)}'`;
    expect(message).toHaveLength(4096);

    const cls = classifyFromError({ message });
    expect(cls.category).toBe('null_value');
  });

  test('skips regex classification one character past the 4096-char boundary', () => {
    const prefix = "Cannot access 'name' on null '";
    const message = `${prefix}${'x'.repeat(4097 - prefix.length - 1)}'`;
    expect(message).toHaveLength(4097);

    const cls = classifyFromError({ message });
    expect(cls.category).toBe('unknown');
  });
});
