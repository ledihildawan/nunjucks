import { describe, test, expect } from 'bun:test';
import {
  normalizeIncludeChain,
  resolveTemplateName,
  validateTemplateName,
  findCachedTemplate,
} from './resolver.js';
import { createTemplate } from '../template/index.js';

describe('normalizeIncludeChain', () => {
  test('returns defaults for null/undefined', () => {
    expect(normalizeIncludeChain(null)).toEqual({ parentName: null, chain: null });
    expect(normalizeIncludeChain(undefined)).toEqual({ parentName: null, chain: null });
  });

  test('returns parentName for string input', () => {
    expect(normalizeIncludeChain('foo')).toEqual({ parentName: 'foo', chain: null });
  });

  test('returns parentName and chain for object input', () => {
    const chainObj = { parentTmpl: 'bar', other: 1 };
    expect(normalizeIncludeChain(chainObj)).toEqual({ parentName: 'bar', chain: chainObj });
  });
});

describe('resolveTemplateName', () => {
  test('returns raw property when input has raw', () => {
    expect(resolveTemplateName({ raw: 'rawName' })).toBe('rawName');
  });

  test('returns input itself when no raw property', () => {
    expect(resolveTemplateName('stringName')).toBe('stringName');
  });
});

describe('validateTemplateName', () => {
  test('returns null for Template instance', () => {
    const tmpl = createTemplate('hi', null);
    expect(validateTemplateName(tmpl)).toBeNull();
  });

  test('returns null for string', () => {
    expect(validateTemplateName('foo')).toBeNull();
  });

  test('throws for non-string, non-Template', () => {
    expect(() => validateTemplateName(123)).toThrow('template names must be a string: 123');
    const err = (() => { try { validateTemplateName(123); } catch (e) { return e; } })();
    expect(err.code).toBe('INVALID_INCLUDE');
  });
});

describe('findCachedTemplate', () => {
  const loaderA = {
    cache: { 'resolvedA': { name: 'tmplA' } },
  };
  const loaderB = {
    cache: { 'resolvedB': { name: 'tmplB' } },
  };
  const resolveFn = (loader, parentName, name) => {
    if (loader === loaderA) return 'resolvedA';
    if (loader === loaderB) return 'resolvedB';
    return name;
  };

  test('finds template from first loader', () => {
    const result = findCachedTemplate([loaderA, loaderB], resolveFn, 'foo', 'parent');
    expect(result).toEqual({ tmpl: { name: 'tmplA' }, loader: loaderA });
  });

  test('finds template from second loader', () => {
    const result = findCachedTemplate([loaderB], resolveFn, 'foo', 'parent');
    expect(result).toEqual({ tmpl: { name: 'tmplB' }, loader: loaderB });
  });

  test('returns null when no loader has cached template', () => {
    const loaderEmpty = { cache: {} };
    const result = findCachedTemplate([loaderEmpty], resolveFn, 'foo', 'parent');
    expect(result).toBeNull();
  });
});
