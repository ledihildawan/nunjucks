import type { Env } from '@nunjucks/runtime';
import { createFallbackEnv } from './template-source.ts';
import type { RootRenderFunc, TemplateState } from './types.ts';

interface TestTemplateStateOptions {
  tmplStr?: string;
  env?: Env;
  rootRenderFunc?: RootRenderFunc | null;
}

/**
 * Builds the canonical `source`-state fixture shared by the template-domain suites
 * (compiler/exporter/renderer) — one factory instead of a repeated 11-field literal.
 */
const createSourceTemplateState = ({
  tmplStr = 'Hello',
  env = createFallbackEnv(),
  rootRenderFunc = null,
}: TestTemplateStateOptions = {}): TemplateState =>
  // WHY: renderer tests stub safeCompile and inject a fake root generator while still
  // claiming `status: 'source'` — not a representable TemplateState variant, so this one
  // widening cast is centralized here instead of `as unknown as` casts in every suite.
  ({
    env,
    path: 'test.html',
    includeChain: null,
    status: 'source',
    tmplStr,
    tmplProps: null,
    blocks: {},
    blockMeta: {},
    rootRenderFunc,
  }) as TemplateState;

export type { TestTemplateStateOptions };
export { createSourceTemplateState };
