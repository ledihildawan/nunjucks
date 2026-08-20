import { describe, expect, test } from 'bun:test';
import type { Frame } from '@nunjucks/runtime';
import { createRenderFrame, createTemplateRenderer } from './template-renderer.ts';
import { createFallbackEnv } from './template-source.ts';
import { createSourceTemplateState } from './template-test-helper.ts';
import type { RootRenderFunc } from './types.ts';

describe('createRenderFrame', () => {
  test('creates frame with topLevel true when no parent', () => {
    const frame = createRenderFrame(undefined);
    expect(frame.topLevel).toBe(true);
  });

  test('creates child frame when parent provided', () => {
    const parent = { push: () => ({ topLevel: false }), topLevel: false } as unknown as Frame;
    const frame = createRenderFrame(parent);
    expect(frame.topLevel).toBe(true);
  });
});

describe('createTemplateRenderer', () => {
  test('throws when rootRenderFunc is missing', async () => {
    const getState = () => createSourceTemplateState();
    const compiler = { safeCompile: async () => {} };
    const errorHandler = { enrichError: (e: Error) => e };
    const renderer = createTemplateRenderer({ getState, compiler, errorHandler });
    await expect(renderer.render({})).rejects.toThrow(/no compiled root render function/);
  });

  test('safeCompile is called before render', async () => {
    let compileCalled = false;
    const getState = () =>
      createSourceTemplateState({
        rootRenderFunc: async function* () {
          yield 'ok';
        } as unknown as RootRenderFunc,
      });
    const compiler = {
      safeCompile: async () => {
        compileCalled = true;
      },
    };
    const errorHandler = { enrichError: (e: Error) => e };
    const renderer = createTemplateRenderer({ getState, compiler, errorHandler });
    await renderer.render({});
    expect(compileCalled).toBe(true);
  });

  test('throws circular include when template is already rendering', async () => {
    const renderingTemplates = new Set(['test.html']);
    const env = createFallbackEnv() as ReturnType<typeof createFallbackEnv> & {
      renderingTemplates: Set<string>;
    };
    env.renderingTemplates = renderingTemplates;
    const getState = () =>
      createSourceTemplateState({
        env,
        rootRenderFunc: async function* () {
          yield 'ok';
        } as unknown as RootRenderFunc,
      });
    const compiler = { safeCompile: async () => {} };
    const errorHandler = { enrichError: (e: Error) => e };
    const renderer = createTemplateRenderer({ getState, compiler, errorHandler });
    await expect(renderer.render({})).rejects.toThrow(/Circular include/);
  });

  test('removes path from renderingTemplates after render', async () => {
    const renderingTemplates = new Set<string>();
    const env = createFallbackEnv() as ReturnType<typeof createFallbackEnv> & {
      renderingTemplates: Set<string>;
    };
    env.renderingTemplates = renderingTemplates;
    const getState = () =>
      createSourceTemplateState({
        env,
        rootRenderFunc: async function* () {
          yield 'ok';
        } as unknown as RootRenderFunc,
      });
    const compiler = { safeCompile: async () => {} };
    const errorHandler = { enrichError: (e: Error) => e };
    const renderer = createTemplateRenderer({ getState, compiler, errorHandler });
    await renderer.render({});
    expect(renderingTemplates.has('test.html')).toBe(false);
  });
});
