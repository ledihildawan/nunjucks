import { describe, test, expect } from 'bun:test';
import { createTemplateCompiler } from './template-compiler.ts';
import { createFallbackEnv } from './template-source.ts';

describe('createTemplateCompiler', () => {
  test('compile returns void', () => {
    const env = createFallbackEnv();
    const getState = () => ({
      env,
      path: 'test.html',
      includeChain: null,
      status: 'source' as const,
      tmplStr: 'Hello',
      tmplProps: null,
      blocks: {},
      blockMeta: {},
      rootRenderFunc: null,
    });
    const commit = () => {};
    const compiler = createTemplateCompiler({ getState, commit });
    expect(typeof compiler.compile).toBe('function');
  });

  test('safeCompile returns Promise', () => {
    const env = createFallbackEnv();
    const getState = () => ({
      env,
      path: 'test.html',
      includeChain: null,
      status: 'source' as const,
      tmplStr: 'Hello',
      tmplProps: null,
      blocks: {},
      blockMeta: {},
      rootRenderFunc: null,
    });
    const commit = () => {};
    const compiler = createTemplateCompiler({ getState, commit });
    expect(compiler.safeCompile()).toBeInstanceOf(Promise);
  });

  test('compile does not throw on valid template', () => {
    const env = createFallbackEnv();
    const getState = () => ({
      env,
      path: 'test.html',
      includeChain: null,
      status: 'source' as const,
      tmplStr: 'Hello {{ name }}',
      tmplProps: null,
      blocks: {},
      blockMeta: {},
      rootRenderFunc: null,
    });
    const commit = () => {};
    const compiler = createTemplateCompiler({ getState, commit });
    compiler.compile();
  });

  test('compile throws prettified error on invalid template', () => {
    const env = createFallbackEnv();
    const getState = () => ({
      env,
      path: 'test.html',
      includeChain: null,
      status: 'source' as const,
      tmplStr: '{{ invalid--syntax',
      tmplProps: null,
      blocks: {},
      blockMeta: {},
      rootRenderFunc: null,
    });
    const commit = () => {};
    const compiler = createTemplateCompiler({ getState, commit });
    expect(() => compiler.compile()).toThrow();
  });
});
