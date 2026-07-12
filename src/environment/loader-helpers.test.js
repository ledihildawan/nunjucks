import { describe, test, expect } from 'bun:test';
import { isRelativePath, resolveTemplatePath } from './loader-helpers.js';
import {
  findCachedTemplate, normalizeIncludeChain,
  resolveTemplateName, validateTemplateName,
} from './resolver.js';

describe('isRelativePath', () => {
  test('returns true when loader.isRelative returns truthy', () => {
    const loader = { isRelative: (f) => f.startsWith('.') };
    expect(isRelativePath(loader, './foo.njk')).toBe(true);
    expect(isRelativePath(loader, 'foo.njk')).toBe(false);
  });

  test('returns false when loader has no isRelative', () => {
    expect(isRelativePath({}, 'foo.njk')).toBe(false);
  });
});

describe('resolveTemplatePath', () => {
  test('resolves relative path using loader', () => {
    const loader = {
      isRelative: (f) => f.startsWith('.'),
      resolve: (parent, filename) => `/resolved/${filename}`,
    };
    expect(resolveTemplatePath(loader, 'parent.njk', './child.njk')).toBe('/resolved/./child.njk');
  });

  test('returns filename as-is for non-relative path', () => {
    const loader = { isRelative: (f) => f.startsWith('.') };
    expect(resolveTemplatePath(loader, 'parent.njk', 'absolute.njk')).toBe('absolute.njk');
  });
});

describe('findCachedTemplate', () => {
  test('returns null when no loader has cache', () => {
    const loaders = [{ cache: {} }, { cache: {} }];
    const resolveFn = () => 'test.njk';
    expect(findCachedTemplate(loaders, resolveFn, 'test.njk')).toBeNull();
  });

  test('returns cached template and loader', () => {
    const tmpl = {};
    const loaders = [
      { cache: {} },
      { cache: { 'test.njk': tmpl } },
    ];
    const resolveFn = (loader, parent, name) => name;
    const result = findCachedTemplate(loaders, resolveFn, 'test.njk');
    expect(result.tmpl).toBe(tmpl);
    expect(result.loader).toBe(loaders[1]);
  });
});

describe('normalizeIncludeChain', () => {
  test('returns defaults for null', () => {
    expect(normalizeIncludeChain(null)).toEqual({ parentName: null, chain: null });
  });

  test('returns parentName for string', () => {
    expect(normalizeIncludeChain('parent.njk')).toEqual({ parentName: 'parent.njk', chain: null });
  });

  test('returns parentTmpl and chain for object', () => {
    const chain = { parentTmpl: 'base.njk' };
    expect(normalizeIncludeChain(chain)).toEqual({ parentName: 'base.njk', chain });
  });

  test('returns defaults for unknown type', () => {
    expect(normalizeIncludeChain(42)).toEqual({ parentName: null, chain: null });
  });
});

describe('resolveTemplateName', () => {
  test('returns raw property if present', () => {
    expect(resolveTemplateName({ raw: 'template.njk' })).toBe('template.njk');
  });

  test('returns name as-is if string', () => {
    expect(resolveTemplateName('template.njk')).toBe('template.njk');
  });

  test('returns null for null/undefined', () => {
    expect(resolveTemplateName(null)).toBeNull();
    expect(resolveTemplateName(undefined)).toBeUndefined();
  });
});

describe('validateTemplateName', () => {
  test('returns null for string', () => {
    expect(validateTemplateName('template.njk')).toBeNull();
  });

  test('throws for non-string', () => {
    expect(() => validateTemplateName(42)).toThrow('template names must be a string');
  });

  test('error has INVALID_INCLUDE code', () => {
    try {
      validateTemplateName(null);
    } catch (e) {
      expect(e.code).toBe('INVALID_INCLUDE');
    }
  });
});
