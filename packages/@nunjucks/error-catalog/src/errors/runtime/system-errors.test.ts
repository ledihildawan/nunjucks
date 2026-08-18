import { describe, expect, test } from 'bun:test';
import { classifyFromError } from '../classify.ts';
import type { ErrorDefinition } from '../types.ts';
import {
  ASSERT_TYPE_ERROR,
  EXEC_EXPRESSION_ERROR,
  INVALID_ASSIGN_TARGET,
  RENDER_ERROR,
  STREAM_ALREADY_CONSUMED,
  TIMEOUT,
  UNAVAILABLE_IN_ENV,
} from './system-errors.ts';

const defs: readonly [string, ErrorDefinition][] = [
  ['TIMEOUT', TIMEOUT],
  ['ASSERT_TYPE_ERROR', ASSERT_TYPE_ERROR],
  ['INVALID_ASSIGN_TARGET', INVALID_ASSIGN_TARGET],
  ['STREAM_ALREADY_CONSUMED', STREAM_ALREADY_CONSUMED],
  ['UNAVAILABLE_IN_ENV', UNAVAILABLE_IN_ENV],
  ['EXEC_EXPRESSION_ERROR', EXEC_EXPRESSION_ERROR],
  ['RENDER_ERROR', RENDER_ERROR],
];

describe('system error definitions', () => {
  test('each def is keyed by its own name and carries guidance', () => {
    for (const [name, def] of defs) {
      expect(def.name).toBe(name);
      expect(def.category).not.toBe('');
      expect(def.causes.length).toBeGreaterThan(0);
      expect(def.fixComment).toBeTruthy();
    }
  });

  test('internal-error docs point at the issue tracker', () => {
    expect(ASSERT_TYPE_ERROR.documentationUrl).toBe('https://github.com/mozilla/nunjucks/issues');
    expect(ASSERT_TYPE_ERROR.fixCode).toContain('report this as a bug');
  });
});

describe('TIMEOUT', () => {
  test('pattern is anchored to the full timed-out message and extracts no subject', () => {
    const { pattern, subjectFrom } = TIMEOUT;
    expect(pattern.test('Template rendering timed out after 5000ms')).toBe(true);
    expect(pattern.test('Template rendering timed out')).toBe(false);
    expect(subjectFrom).toBeNull();
  });

  test('classification maps to the timeout category', () => {
    expect(
      classifyFromError({ message: 'Template rendering timed out after 100ms' }).category
    ).toBe('timeout_error');
  });
});

describe('EXEC_EXPRESSION_ERROR', () => {
  test('extraFrom maps the capture to the detail placeholder', () => {
    const match = 'Exec expression failed: boom'.match(
      EXEC_EXPRESSION_ERROR.pattern
    ) as RegExpMatchArray;
    expect(EXEC_EXPRESSION_ERROR.extraFrom?.(match)).toStrictEqual({ detail: 'boom' });
  });
});

describe('STREAM_ALREADY_CONSUMED', () => {
  test('pattern matches the full single-use stream message including punctuation', () => {
    const message =
      'renderToStream: stream already consumed — a stream is single-use; call renderToStream() again for a fresh stream';
    expect(STREAM_ALREADY_CONSUMED.pattern.test(message)).toBe(true);
    expect(classifyFromError({ message }).category).toBe('api_misuse');
  });
});

describe('RENDER_ERROR', () => {
  test('is the no-code fallback: category runtime_error, guidance without a fix snippet', () => {
    const cls = classifyFromError({ code: 'RENDER_ERROR' });
    expect(cls.category).toBe('runtime_error');
    expect(cls.fixCode).toBeNull();
    expect(cls.fixComment).toBeTruthy();
    expect(cls.causes.length).toBeGreaterThan(0);
  });
});

describe('UNAVAILABLE_IN_ENV', () => {
  test('pattern matches the exact unavailable message, case-insensitively', () => {
    expect(UNAVAILABLE_IN_ENV.pattern.test('not available in this environment')).toBe(true);
    expect(UNAVAILABLE_IN_ENV.pattern.test('NOT AVAILABLE IN THIS ENVIRONMENT')).toBe(true);
    expect(UNAVAILABLE_IN_ENV.pattern.test('filter x is not available in this environment')).toBe(
      false
    );
  });
});

describe('INVALID_ASSIGN_TARGET', () => {
  test('classification maps to the runtime category', () => {
    expect(classifyFromError({ message: 'Invalid left-hand side expression' }).category).toBe(
      'runtime_error'
    );
  });
});
