import { describe, test, expect } from 'bun:test';
import {
  prepareSandbox,
  createEnvLookups,
  TEMPLATE_FILE_EXTENSION_RE,
} from './render-pipeline.ts';
import type { RenderConfig } from './render-types.ts';

describe('render-pipeline', () => {
  describe('TEMPLATE_FILE_EXTENSION_RE', () => {
    test('matches common template extensions', () => {
      expect(TEMPLATE_FILE_EXTENSION_RE.test('template.njk')).toBe(true);
      expect(TEMPLATE_FILE_EXTENSION_RE.test('template.html')).toBe(true);
      expect(TEMPLATE_FILE_EXTENSION_RE.test('template.htm')).toBe(true);
      expect(TEMPLATE_FILE_EXTENSION_RE.test('template.twig')).toBe(true);
      expect(TEMPLATE_FILE_EXTENSION_RE.test('template.ejs')).toBe(true);
      expect(TEMPLATE_FILE_EXTENSION_RE.test('template.eta')).toBe(true);
    });

    test('matches js extension', () => {
      expect(TEMPLATE_FILE_EXTENSION_RE.test('template.js')).toBe(true);
    });

    test('is case insensitive', () => {
      expect(TEMPLATE_FILE_EXTENSION_RE.test('template.NJK')).toBe(true);
      expect(TEMPLATE_FILE_EXTENSION_RE.test('template.Html')).toBe(true);
    });

    test('does not match non-template files', () => {
      expect(TEMPLATE_FILE_EXTENSION_RE.test('template.txt')).toBe(false);
      expect(TEMPLATE_FILE_EXTENSION_RE.test('template.json')).toBe(false);
      expect(TEMPLATE_FILE_EXTENSION_RE.test('template.ts')).toBe(false);
    });
  });

  describe('prepareSandbox', () => {
    test('returns context unchanged when sandbox is disabled', () => {
      const config = { sandbox: false };
      const context = { name: 'Ada', age: 42 };
      const result = prepareSandbox(config as unknown as RenderConfig, context);
      expect(result).toEqual(context);
    });

    test('merges globals into context', () => {
      const config = { sandbox: false, globals: { global1: 'value1' } };
      const context = { name: 'Ada' };
      const result = prepareSandbox(config as unknown as RenderConfig, context);
      expect(result).toEqual({ name: 'Ada', global1: 'value1' });
    });

    test('handles empty context', () => {
      const config = { sandbox: false };
      const result = prepareSandbox(config as unknown as RenderConfig, {});
      expect(result).toEqual({});
    });

    test('handles null blockedContextKeys', () => {
      const config = { sandbox: true, blockedContextKeys: null };
      const context = { name: 'Ada' };
      const result = prepareSandbox(config as unknown as RenderConfig, context);
      expect(result.name).toBe('Ada');
    });
  });

  describe('createEnvLookups', () => {
    test('creates env with getFilter, getTest, getExtension', () => {
      const config = {
        filters: { myFilter: () => 'filtered' },
        tests: { myTest: () => true },
        extensions: { myExt: { tags: [], parse: () => {} } },
      };
      const lookups = createEnvLookups(config as unknown as RenderConfig);

      expect(typeof lookups.getFilter).toBe('function');
      expect(typeof lookups.getTest).toBe('function');
      expect(typeof lookups.getExtension).toBe('function');
    });

    test('getFilter returns configured filter', () => {
      const config = {
        filters: { uppercase: (v: unknown) => String(v).toUpperCase() },
      };
      const lookups = createEnvLookups(config as unknown as RenderConfig);
      const result = lookups.getFilter!('uppercase', null, null) as (v: unknown) => string;
      expect(result('hello')).toBe('HELLO');
    });

    test('getFilter throws for undefined filter', () => {
      const config = { filters: {} };
      const lookups = createEnvLookups(config as unknown as RenderConfig);
      expect(() => lookups.getFilter!('missing', null, null)).toThrow();
    });

    test('getTest returns configured test', () => {
      const config = {
        tests: { isNumber: (v: unknown) => typeof v === 'number' },
      };
      const lookups = createEnvLookups(config as unknown as RenderConfig);
      const result = lookups.getTest!('isNumber', null, null) as (v: unknown) => boolean;
      expect(result(42)).toBe(true);
      expect(result('42')).toBe(false);
    });

    test('getTest throws for undefined test', () => {
      const config = { tests: {} };
      const lookups = createEnvLookups(config as unknown as RenderConfig);
      expect(() => lookups.getTest!('missing', null, null)).toThrow();
    });

    test('getExtension returns configured extension', () => {
      const myExt = { tags: ['mytag'], parse: () => {} };
      const config = { extensions: { myExtension: myExt } };
      const lookups = createEnvLookups(config as unknown as RenderConfig);
      expect(lookups.getExtension!('myExtension')).toBe(myExt);
    });

    test('getExtension throws for undefined extension', () => {
      const config = { extensions: {} };
      const lookups = createEnvLookups(config as unknown as RenderConfig);
      expect(() => lookups.getExtension!('missing')).toThrow();
    });
  });
});
