import { describe, expect, test } from 'bun:test';
import { ERROR_CODES } from '@nunjucks/error-catalog';
import type { normalizeErrorMetadata } from '@nunjucks/error-formatter';
import { buildErrorDef, extractErrorSnapshot, resolveErrorProps, toRenderContext } from './error-snapshot.ts';

type NormalizedMetadata = ReturnType<typeof normalizeErrorMetadata>;

const metadata = (overrides: Partial<NormalizedMetadata> = {}): NormalizedMetadata => ({
  error: new Error('boom'),
  message: 'boom',
  lineno: 3,
  colno: 7,
  lineBase: 'zero',
  phase: 'render',
  templateName: 'page.njk',
  templatePath: 'page.njk',
  sourceContent: null,
  sourceStartLine: 1,
  renderContext: null,
  code: 'UNDEFINED_VARIABLE',
  subject: 'name',
  ...overrides,
});

describe('extractErrorSnapshot', () => {
  test('returns an empty snapshot for non-object values', () => {
    expect(extractErrorSnapshot('nope')).toEqual({});
    expect(extractErrorSnapshot(null)).toEqual({});
  });

  test('keeps name/message and strips location fields', () => {
    const snapshot = extractErrorSnapshot(
      Object.assign(new Error('kaboom'), { lineno: 2, colno: 4, lineBase: 'one', code: 'X' })
    );
    expect(snapshot.name).toBe('Error');
    expect(snapshot.message).toBe('kaboom');
    expect(snapshot.lineno).toBeUndefined();
    expect(snapshot.colno).toBeUndefined();
    expect(snapshot.lineBase).toBeUndefined();
    expect(snapshot.code).toBe('X');
  });
});

describe('resolveErrorProps', () => {
  test('resolves catalog-style props from a keyed error', () => {
    const props = resolveErrorProps(
      Object.assign(new Error('e'), {
        causes: ['cause a', 'cause b'],
        fixCode: '{{ x := 1 }}',
        severity: 'warning',
      })
    );
    expect(props.resolvedCauses).toEqual(['cause a', 'cause b']);
    expect(props.resolvedFixCode).toBe('{{ x := 1 }}');
    expect(props.originalSeverity).toBe('warning');
  });

  test('drops empty causes and invalid severity', () => {
    const props = resolveErrorProps(Object.assign(new Error('e'), { causes: [], severity: 'loud' }));
    expect(props.resolvedCauses).toBeUndefined();
    expect(props.originalSeverity).toBeUndefined();
  });

  test('returns undefined props for non-object errors', () => {
    const props = resolveErrorProps('plain');
    expect(props.resolvedCauses).toBeUndefined();
    expect(props.resolvedFixCode).toBeUndefined();
    expect(props.originalSeverity).toBeUndefined();
  });
});

describe('toRenderContext', () => {
  test('passes keyed objects through', () => {
    const context = { user: 'alice' };
    expect(toRenderContext(context)).toBe(context);
  });

  test('returns null for non-objects', () => {
    expect(toRenderContext(null)).toBeNull();
    expect(toRenderContext(42)).toBeNull();
  });
});

describe('buildErrorDef', () => {
  test('uses the catalog RENDER_ERROR fallback when no code is present', () => {
    const def = buildErrorDef(metadata({ code: null }), resolveErrorProps(new Error('e')));
    expect(def.name).toBe(ERROR_CODES.RENDER_ERROR);
    expect(def.message()).toBe('boom');
    expect(def.severity).toBe('error');
  });

  test('keeps the snapshot code and resolved props', () => {
    const def = buildErrorDef(
      metadata(),
      resolveErrorProps(Object.assign(new Error('e'), { causes: ['c1'], severity: 'info' }))
    );
    expect(def.name).toBe('UNDEFINED_VARIABLE');
    expect(def.causes).toEqual(['c1']);
    expect(def.severity).toBe('info');
  });
});
