import { describe, expect, test } from 'bun:test';
import type { TemplateError } from '@nunjucks/error-formatter';
import { err, ok } from '@nunjucks/lib';
import { createLoaderChain, type TemplateLoader } from './loader-chain.ts';

interface InMemoryLoaderInput {
  templates: Record<string, string>;
}

// WHY: in-memory fake — proves the TemplateLoader contract without touching the fs shell.
const createInMemoryLoader = ({ templates }: InMemoryLoaderInput): TemplateLoader => ({
  getSource: async (name: string) => {
    if (!Object.hasOwn(templates, name)) {
      return null;
    }
    const src = templates[name];
    return src === undefined ? null : ok({ src, path: name });
  },
});

const failingLoader = (): TemplateLoader => ({
  getSource: async () => err({ code: 'FILESYSTEM_ERROR' } as unknown as TemplateError),
});

describe('createLoaderChain', () => {
  test('resolves from the first loader that has the template', async () => {
    const chain = createLoaderChain([
      createInMemoryLoader({ templates: { 'a.njk': 'from-first' } }),
      createInMemoryLoader({ templates: { 'a.njk': 'from-second' } }),
    ]);
    const result = await chain.getSource('a.njk');
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.value.src).toBe('from-first');
    }
  });

  test('falls through to later loaders on null', async () => {
    const chain = createLoaderChain([
      createInMemoryLoader({ templates: {} }),
      createInMemoryLoader({ templates: { 'b.njk': 'from-second' } }),
    ]);
    const result = await chain.getSource('b.njk');
    if (!result?.ok) {
      throw new Error('expected ok');
    }
    expect(result.value.src).toBe('from-second');
  });

  test('returns null when every loader misses', async () => {
    const chain = createLoaderChain([
      createInMemoryLoader({ templates: {} }),
      createInMemoryLoader({ templates: {} }),
    ]);
    expect(await chain.getSource('missing.njk')).toBeNull();
  });

  test('a hard error short-circuits the chain', async () => {
    const chain = createLoaderChain([failingLoader(), createInMemoryLoader({ templates: {} })]);
    const result = await chain.getSource('any.njk');
    expect(result && !result.ok).toBe(true);
  });

  test('empty chain resolves nothing', async () => {
    const chain = createLoaderChain([]);
    expect(await chain.getSource('x.njk')).toBeNull();
  });
});
