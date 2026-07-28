import { isString, isPlainObject } from 'remeda';
import { createLog } from '@nunjucks/log';
import { getError } from '@nunjucks/log';
import { createEnv } from '../core/env.ts';
import type { Env } from '../core/env.ts';
import type { TemplateSource, TemplateState } from './types';

export { initTemplateState, loadSource, createFallbackEnv };

const createFallbackEnv = (): Env => createEnv({
  opts: { dev: false, autoescape: true },
  globals: {},
  async getTemplate(name: string, _eagerCompile?: boolean, _includeChain?: unknown, ignoreMissing?: boolean) {
    if (ignoreMissing) { return null; }
    throw createLog('error', getError('FILE_NOT_FOUND'), { path: name }, name, { phase: 'load' });
  }
});

const initTemplateState = (_src: string | TemplateSource, env: Env | undefined, path: string | null | undefined, includeChain: unknown[] | null | undefined): TemplateState => ({
  env: env || createFallbackEnv(),
  path: path ?? undefined,
  _includeChain: includeChain ?? null,
  tmplStr: null,
  tmplProps: null,
  blocks: {},
  blockMeta: {},
  rootRenderFunc: null,
  compiled: false,
});

const loadSource = (state: TemplateState, src: string | TemplateSource): void => {
  if (isPlainObject(src)) {
    const srcObj = src as TemplateSource;
    switch (srcObj.type) {
      case 'code':
        state.tmplProps = srcObj.obj as Record<string, unknown>;
        break;
      case 'string':
        state.tmplStr = srcObj.obj as string;
        break;
      default:
        throw createLog('error', getError('TEMPLATE_INVALID_SOURCE'), { type: srcObj.type }, srcObj.type, { phase: 'load' });
    }
  } else if (isString(src)) {
    state.tmplStr = src;
  } else {
    throw createLog('error', getError('TEMPLATE_SRC_STRING'), {}, null, { phase: 'load' });
  }
};
