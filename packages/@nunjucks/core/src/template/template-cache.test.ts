import { describe, expect, test } from 'bun:test';
import { isOk } from '@nunjucks/lib';
import { compileTemplate } from '../render/render-pipeline.ts';
import type { RenderConfig } from '../render/render-types.ts';
import { buildCompileCacheKey, createTemplateCache } from './template-cache.ts';

const baseConfig = {
  undefined: 'default',
  trimBlocks: false,
  lstripBlocks: false,
  streamErrorRecovery: false,
  extensions: undefined,
} as unknown as RenderConfig;

describe('createTemplateCache', () => {
  test('get returns undefined for a miss and the value after set', () => {
    const cache = createTemplateCache();
    expect(cache.get('k')).toBeUndefined();
    cache.set('k', 'compiled-code');
    expect(cache.get('k')).toBe('compiled-code');
    expect(cache.size).toBe(1);
  });

  test('evicts the least-recently-used entry beyond maxEntries', () => {
    const cache = createTemplateCache({ maxEntries: 2 });
    cache.set('a', '1');
    cache.set('b', '2');
    // touch 'a' so 'b' becomes the LRU victim
    expect(cache.get('a')).toBe('1');
    cache.set('c', '3');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('1');
    expect(cache.get('c')).toBe('3');
    expect(cache.size).toBe(2);
  });

  test('set overwrites an existing key without growing the cache', () => {
    const cache = createTemplateCache();
    cache.set('k', 'v1');
    cache.set('k', 'v2');
    expect(cache.size).toBe(1);
    expect(cache.get('k')).toBe('v2');
  });

  test('clear empties every entry', () => {
    const cache = createTemplateCache();
    cache.set('k', 'v');
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('k')).toBeUndefined();
  });
});

describe('buildCompileCacheKey', () => {
  const baseInput = {
    templatePath: '/views/page.njk',
    templateName: 'page.njk',
    source: 'Hello {{ name }}',
    config: baseConfig,
  };

  test('identical inputs build an identical key', () => {
    expect(buildCompileCacheKey(baseInput)).toBe(buildCompileCacheKey({ ...baseInput }));
  });

  test('changed source content changes the key (freshness contract)', () => {
    expect(buildCompileCacheKey(baseInput)).not.toBe(
      buildCompileCacheKey({ ...baseInput, source: 'Hello {{ name }}!' })
    );
  });

  test('changed path or templateName changes the key', () => {
    expect(buildCompileCacheKey(baseInput)).not.toBe(
      buildCompileCacheKey({ ...baseInput, templatePath: '/views/other.njk' })
    );
    expect(buildCompileCacheKey(baseInput)).not.toBe(
      buildCompileCacheKey({ ...baseInput, templateName: 'other.njk' })
    );
  });

  test('every compile-affecting config field participates in the key', () => {
    for (const override of [
      { undefined: 'strict' },
      { trimBlocks: true },
      { lstripBlocks: true },
      { streamErrorRecovery: true },
      { extensions: { hello: {} } },
    ] as const) {
      const variedConfig = { ...baseConfig, ...override } as unknown as RenderConfig;
      expect(buildCompileCacheKey({ ...baseInput, config: variedConfig })).not.toBe(
        buildCompileCacheKey(baseInput)
      );
    }
  });

  test('extension key ORDER does not matter (same dispatch surface, same key)', () => {
    const withAb = {
      ...baseInput,
      config: { ...baseConfig, extensions: { a: {}, b: {} } } as unknown as RenderConfig,
    };
    const withBa = {
      ...baseInput,
      config: { ...baseConfig, extensions: { b: {}, a: {} } } as unknown as RenderConfig,
    };
    expect(buildCompileCacheKey(withAb)).toBe(buildCompileCacheKey(withBa));
  });
});

describe('compileTemplate dedupe (cache seam)', () => {
  const configWithCache = (cache: ReturnType<typeof createTemplateCache> | null): RenderConfig =>
    ({
      ...baseConfig,
      compiledCodeCache: cache,
      templatePath: '/views/dedupe.njk',
    }) as unknown as RenderConfig;

  test('identical inputs hit the cache: same code object identity, one entry', () => {
    const cache = createTemplateCache();
    const input = {
      templateSource: 'Hello {{ name }}',
      config: configWithCache(cache),
      templateName: 'dedupe.njk',
    };
    const first = compileTemplate(input);
    const second = compileTemplate(input);
    expect(isOk(first)).toBe(true);
    expect(isOk(second)).toBe(true);
    if (isOk(first) && isOk(second)) {
      // WHY: toBe — the hit must return the CACHED string, not a recompiled equal one.
      expect(second.value.code).toBe(first.value.code);
    }
    expect(cache.size).toBe(1);
  });

  test('a failed compile is never pinned: cache stays empty and a retry recompiles', () => {
    const cache = createTemplateCache();
    const broken = compileTemplate({
      templateSource: '{{ unclosed',
      config: configWithCache(cache),
      templateName: 'broken.njk',
    });
    expect(broken.ok).toBe(false);
    expect(cache.size).toBe(0);
    const repaired = compileTemplate({
      templateSource: '{{ fixed }}',
      config: configWithCache(cache),
      templateName: 'broken.njk',
    });
    expect(isOk(repaired)).toBe(true);
    expect(cache.size).toBe(1);
  });

  test('a null cache compiles every time (disabled path)', () => {
    const input = {
      templateSource: 'Hello',
      config: configWithCache(null),
      templateName: 'off.njk',
    };
    expect(isOk(compileTemplate(input))).toBe(true);
    expect(isOk(compileTemplate(input))).toBe(true);
  });
});
