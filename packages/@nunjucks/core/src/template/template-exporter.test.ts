import { describe, expect, test } from 'bun:test';
import { createGetExported } from './template-exporter.ts';
import { createFallbackEnv } from './template-source.ts';

describe('createGetExported', () => {
  test('returns empty exported when rootRenderFunc is null', async () => {
    const getState = () => ({
      env: createFallbackEnv(),
      path: 'test.html',
      includeChain: null,
      status: 'source' as const,
      tmplStr: 'Hello',
      tmplProps: null,
      blocks: {},
      blockMeta: {},
      rootRenderFunc: null,
    });
    const getExported = createGetExported(getState, { safeCompile: async () => {} });
    const result = await getExported();
    expect(result).toEqual({});
  });

  test('calls safeCompile before rendering', async () => {
    let compileCalled = false;
    const compiler = {
      safeCompile: async () => {
        compileCalled = true;
      },
    };
    const getState = () => ({
      env: createFallbackEnv(),
      path: 'test.html',
      includeChain: null,
      status: 'source' as const,
      tmplStr: 'Hello',
      tmplProps: null,
      blocks: {},
      blockMeta: {},
      rootRenderFunc: null,
    });
    const getExported = createGetExported(getState, compiler);
    await getExported();
    expect(compileCalled).toBe(true);
  });

  test('throws prettifyError when compile fails', async () => {
    const compiler = {
      safeCompile: async () => {
        throw new Error('compile failed');
      },
    };
    const getState = () => ({
      env: createFallbackEnv(),
      path: 'test.html',
      includeChain: null,
      status: 'source' as const,
      tmplStr: 'Hello',
      tmplProps: null,
      blocks: {},
      blockMeta: {},
      rootRenderFunc: null,
    });
    const getExported = createGetExported(getState, compiler);
    await expect(getExported()).rejects.toThrow();
  });
});
