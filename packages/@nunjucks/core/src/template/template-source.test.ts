import { describe, test, expect } from 'bun:test';
import { initTemplateState, loadSource, createFallbackEnv } from './template-source.ts';
import { BLOCK_META_KEY } from '@nunjucks/shared';
import type { TemplateSource } from './types.ts';

describe('createFallbackEnv', () => {
  test('creates env with default opts', () => {
    const env = createFallbackEnv();
    expect(env.opts.dev).toBe(false);
    expect(env.opts.autoescape).toBe(true);
    expect(env.opts.undefined).toBe('default');
  });

  test('getFilter returns null', () => {
    const env = createFallbackEnv();
    expect(env.getFilter!('test', null, null)).toBeNull();
  });

  test('getTest returns null', () => {
    const env = createFallbackEnv();
    expect(env.getTest!('test', null, null)).toBeNull();
  });

  test('getTemplate throws when template not found', () => {
    const env = createFallbackEnv();
    expect(() => env.getTemplate!('missing.html')).toThrow();
  });

  test('getTemplate returns null when ignoreMissing is true', () => {
    const env = createFallbackEnv();
    expect(env.getTemplate!('missing.html', false, undefined, true)).toBeNull();
  });
});

describe('initTemplateState', () => {
  test('creates state with fallback env when none provided', () => {
    const state = initTemplateState({ src: 'test', env: undefined, path: undefined, includeChain: undefined });
    expect(state.env).toBeDefined();
    expect(state.path).toBeUndefined();
    expect(state.includeChain).toBeNull();
    expect(state.blocks).toEqual({});
    expect(state.blockMeta).toEqual({});
  });

  test('uses provided env', () => {
    const env = createFallbackEnv();
    const state = initTemplateState({ src: 'test', env, path: 'test.html', includeChain: null });
    expect(state.env).toBe(env);
    expect(state.path).toBe('test.html');
  });

  test('uses provided path', () => {
    const state = initTemplateState({ src: 'test', env: undefined, path: 'custom.html', includeChain: undefined });
    expect(state.path).toBe('custom.html');
  });
});

describe('loadSource', () => {
  test('loads string source as source status', () => {
    const base = initTemplateState({ src: 'test', env: undefined, path: undefined, includeChain: undefined });
    const state = loadSource(base, 'Hello {{ name }}');
    expect(state.status).toBe('source');
    expect(state.tmplStr).toBe('Hello {{ name }}');
    expect(state.tmplProps).toBeNull();
    expect(state.rootRenderFunc).toBeNull();
  });

  test('loads code source as compiled status', () => {
    const base = initTemplateState({ src: 'test', env: undefined, path: undefined, includeChain: undefined });
    const compiled = { root: async function*() {}, [BLOCK_META_KEY]: {} };
    const state = loadSource(base, { type: 'code', value: compiled });
    expect(state.status).toBe('compiled');
    expect(state.tmplStr).toBeNull();
    expect(state.tmplProps).toBe(compiled);
    expect(state.rootRenderFunc).toBe(compiled.root);
  });

  test('loads string source object', () => {
    const base = initTemplateState({ src: 'test', env: undefined, path: undefined, includeChain: undefined });
    const state = loadSource(base, { type: 'string', value: 'template string' });
    expect(state.status).toBe('source');
    expect(state.tmplStr).toBe('template string');
  });

  test('throws on invalid source type', () => {
    const base = initTemplateState({ src: 'test', env: undefined, path: undefined, includeChain: undefined });
    expect(() => loadSource(base, { type: 'invalid', value: 'test' } as unknown as TemplateSource)).toThrow();
  });

  test('throws on non-string non-object source', () => {
    const base = initTemplateState({ src: 'test', env: undefined, path: undefined, includeChain: undefined });
    expect(() => loadSource(base, 123 as unknown as string | TemplateSource)).toThrow();
  });
});
