import { describe, expect, test } from 'bun:test';
import { WARNINGS_CONTEXT_KEY } from '@nunjucks/shared';
import type { NullAccessResult, PropertyNotFoundResult } from './member-access.ts';
import type { ResolveUndefinedOptions } from './undefined-rules.ts';
import {
  resolveNullAccess,
  resolveUndefinedProperty,
  resolveUndefinedValue,
} from './undefined-rules.ts';

const makeResolveOptions = (
  mode: ResolveUndefinedOptions['mode'],
  varName: string | null = null,
  runtimeContext: unknown = {}
): ResolveUndefinedOptions => ({
  runtimeContext,
  subjectValue: undefined,
  varName,
  lineno: 3,
  colno: 7,
  mode,
  phase: 'render',
  templateName: 'page.njk',
});

const makeWarningsContext = () => {
  const warnings: unknown[] = [];
  return { runtimeContext: { [WARNINGS_CONTEXT_KEY]: warnings }, warnings };
};

const propNotFound = (path = 'name', parent: string | null = 'user'): PropertyNotFoundResult => ({
  __nunjucks_prop_not_found__: true,
  __nunjucks_parent__: parent,
  __nunjucks_access_path__: path,
});

const nullAccess = (path = 'name', parent: string | null = 'user'): NullAccessResult => ({
  __nunjucks_null__: true,
  __nunjucks_parent__: parent,
  __nunjucks_access_path__: path,
});

describe('resolveUndefinedProperty', () => {
  test('chainable mode returns "undefined" without throwing or warning', () => {
    const { runtimeContext, warnings } = makeWarningsContext();
    expect(
      resolveUndefinedProperty(
        propNotFound(),
        makeResolveOptions('chainable', 'user', runtimeContext)
      )
    ).toBe('undefined');
    expect(warnings).toHaveLength(0);
  });

  test('debug mode collects an UNDEFINED_PROPERTY warning naming path and parent', () => {
    const { runtimeContext, warnings } = makeWarningsContext();
    expect(
      resolveUndefinedProperty(
        propNotFound('age', 'user'),
        makeResolveOptions('debug', 'user', runtimeContext)
      )
    ).toBe('undefined');
    expect(warnings).toHaveLength(1);
    const warning = warnings[0] as { code: string; message: string };
    expect(warning.code).toBe('UNDEFINED_PROPERTY');
    expect(warning.message).toBe("Property 'age' not found in 'user'");
  });

  test('strict mode throws UNDEFINED_PROPERTY with the not-found message', () => {
    expect(() =>
      resolveUndefinedProperty(propNotFound(), makeResolveOptions('strict', 'user'))
    ).toThrow("Property 'name' not found in 'user'");
    try {
      resolveUndefinedProperty(propNotFound(), makeResolveOptions('strict', 'user'));
    } catch (thrown) {
      expect((thrown as { code: string }).code).toBe('UNDEFINED_PROPERTY');
    }
  });

  test('derives the parent from a dotted varName when the marker carries none', () => {
    const markerWithoutParent = propNotFound('x', null);
    expect(() =>
      resolveUndefinedProperty(markerWithoutParent, makeResolveOptions('strict', 'user.profile'))
    ).toThrow("in 'user'");
  });
});

describe('resolveNullAccess', () => {
  test('chainable mode returns "undefined" without throwing or warning', () => {
    const { runtimeContext, warnings } = makeWarningsContext();
    expect(
      resolveNullAccess(nullAccess(), makeResolveOptions('chainable', 'user', runtimeContext))
    ).toBe('undefined');
    expect(warnings).toHaveLength(0);
  });

  test('debug mode collects a NULL_VALUE warning naming the access path', () => {
    const { runtimeContext, warnings } = makeWarningsContext();
    expect(
      resolveNullAccess(
        nullAccess('name', 'user'),
        makeResolveOptions('debug', 'user', runtimeContext)
      )
    ).toBe('undefined');
    expect(warnings).toHaveLength(1);
    const warning = warnings[0] as { code: string; message: string };
    expect(warning.code).toBe('NULL_VALUE');
    expect(warning.message).toBe("Cannot access 'name' on null 'user'");
  });

  test('strict mode throws NULL_VALUE with the null-access message', () => {
    expect(() => resolveNullAccess(nullAccess(), makeResolveOptions('strict', 'user'))).toThrow(
      "Cannot access 'name' on null 'user'"
    );
    try {
      resolveNullAccess(nullAccess(), makeResolveOptions('strict', 'user'));
    } catch (thrown) {
      expect((thrown as { code: string }).code).toBe('NULL_VALUE');
    }
  });

  test('falls back to varName for the parent when the marker carries none', () => {
    const markerWithoutParent = nullAccess('x', null);
    expect(() =>
      resolveNullAccess(markerWithoutParent, makeResolveOptions('strict', 'user'))
    ).toThrow("on null 'user'");
  });
});

describe('resolveUndefinedValue', () => {
  test('chainable mode returns "undefined" with a varName present', () => {
    const { runtimeContext, warnings } = makeWarningsContext();
    expect(resolveUndefinedValue(makeResolveOptions('chainable', 'x', runtimeContext))).toBe(
      'undefined'
    );
    expect(warnings).toHaveLength(0);
  });

  test('chainable mode returns "undefined" without a varName', () => {
    expect(resolveUndefinedValue(makeResolveOptions('chainable', null))).toBe('undefined');
  });

  test('strict mode with a varName throws UNDEFINED_VARIABLE naming it', () => {
    expect(() => resolveUndefinedValue(makeResolveOptions('strict', 'myVar'))).toThrow("'myVar'");
    try {
      resolveUndefinedValue(makeResolveOptions('strict', 'myVar'));
    } catch (thrown) {
      expect((thrown as { code: string }).code).toBe('UNDEFINED_VARIABLE');
    }
  });

  test('strict mode without a varName throws UNDEFINED_VALUE', () => {
    try {
      resolveUndefinedValue(makeResolveOptions('strict', null));
    } catch (thrown) {
      expect((thrown as { code: string }).code).toBe('UNDEFINED_VALUE');
    }
  });

  test('debug mode collects an UNDEFINED_VARIABLE warning with the varName message', () => {
    const { runtimeContext, warnings } = makeWarningsContext();
    expect(resolveUndefinedValue(makeResolveOptions('debug', 'v', runtimeContext))).toBe(
      'undefined'
    );
    expect(warnings).toHaveLength(1);
    const warning = warnings[0] as { code: string; message: string };
    expect(warning.code).toBe('UNDEFINED_VARIABLE');
    expect(warning.message).toBe("Variable 'v' is undefined or null");
  });

  test('debug mode without a varName warns with the anonymous message', () => {
    const { runtimeContext, warnings } = makeWarningsContext();
    resolveUndefinedValue(makeResolveOptions('debug', null, runtimeContext));
    const warning = warnings[0] as { message: string };
    expect(warning.message).toBe('Variable is undefined or null');
  });
});
