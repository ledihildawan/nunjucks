import { describe, expect, test } from 'bun:test';
import type { NunjucksPlugin } from './plugin.ts';
import { foldPlugins } from './plugin.ts';

describe('foldPlugins', () => {
  test('returns the empty fold when no plugins are supplied', () => {
    const folded = foldPlugins();
    expect(folded.filters).toEqual({});
    expect(folded.globals).toEqual({});
    expect(folded.tests).toEqual({});
    expect(folded.extensions).toEqual({});
    expect(folded.dompurify).toBeUndefined();
  });

  test('merges a single plugin filters/globals/tests/extensions verbatim', () => {
    const plugin: NunjucksPlugin = {
      name: 'p1',
      filters: { upper: (s: unknown) => String(s).toUpperCase() },
      globals: { siteName: 'nunjucks' },
      tests: { even: (n: unknown) => typeof n === 'number' && n % 2 === 0 },
      extensions: { CustomTag: class {} },
    };
    const folded = foldPlugins([plugin]);
    expect(Object.keys(folded.filters)).toEqual(['upper']);
    expect(folded.globals.siteName).toBe('nunjucks');
    expect(typeof folded.tests.even).toBe('function');
    expect(typeof folded.extensions.CustomTag).toBe('function');
  });

  test('later plugin overrides earlier same-named filter/global', () => {
    const first: NunjucksPlugin = { name: 'a', filters: { up: () => 'first' } };
    const second: NunjucksPlugin = { name: 'b', filters: { up: () => 'second' } };
    const folded = foldPlugins([first, second]);
    expect((folded.filters.up as () => string)()).toBe('second');
  });

  test('dompurify uses last-plugin-wins', () => {
    const first: NunjucksPlugin = { name: 'a', dompurify: { ALLOWED_TAGS: ['b'] } };
    const second: NunjucksPlugin = { name: 'b', dompurify: { ALLOWED_TAGS: ['i'] } };
    expect(foldPlugins([first, second]).dompurify?.ALLOWED_TAGS).toEqual(['i']);
    expect(foldPlugins([second, first]).dompurify?.ALLOWED_TAGS).toEqual(['b']);
  });

  test('drops null/undefined extension values (§5 plugin-value boundary gate)', () => {
    const malformed: NunjucksPlugin = {
      name: 'bad',
      filters: { good: () => 'ok', badNull: null, badUndef: undefined },
      globals: { validGlobal: 0, nullGlobal: null },
    };
    const folded = foldPlugins([malformed]);
    expect(Object.keys(folded.filters).sort()).toEqual(['good']);
    expect(Object.keys(folded.globals).sort()).toEqual(['validGlobal']);
  });

  test('keeps falsey-but-defined values (0, false, empty string) in globals', () => {
    const plugin: NunjucksPlugin = {
      name: 'falsy',
      globals: { zero: 0, empty: '', no: false, nil: null },
    };
    const folded = foldPlugins([plugin]);
    expect(folded.globals.zero).toBe(0);
    expect(folded.globals.empty).toBe('');
    expect(folded.globals.no).toBe(false);
    expect('nil' in folded.globals).toBe(false);
  });
});
