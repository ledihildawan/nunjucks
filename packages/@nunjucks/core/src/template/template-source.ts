import { isString, isPlainObject } from 'remeda';
import { createLog } from '@nunjucks/log';
import { getError } from '@nunjucks/log';
import type { Env } from '@nunjucks/runtime';
import type { IncludeChain } from '@nunjucks/log';
import type { CompiledTemplateExports } from '@nunjucks/shared';
import type { TemplateSource, TemplateState } from './types';

export { initTemplateState, loadSource, createFallbackEnv };

const createFallbackEnv = (): Env => ({
  opts: { dev: false, autoescape: true, undefined: 'default' },
  getFilter: () => null,
  getTest: () => null,
  getTemplate(name: string, _eagerCompile?: boolean, _includeChain?: unknown, ignoreMissing?: boolean) {
    if (ignoreMissing) { return null; }
    throw createLog('error', { def: getError('FILE_NOT_FOUND'), params: { path: name }, subject: name, context: { phase: 'load' } });
  },
});

interface InitTemplateStateOptions {
  src: string | TemplateSource;
  env: Env | undefined;
  path: string | null | undefined;
  includeChain: IncludeChain | null | undefined;
}

const initTemplateState = ({ src: _src, env, path, includeChain }: InitTemplateStateOptions): TemplateState => ({
  env: env ?? createFallbackEnv(),
  path: path ?? undefined,
  includeChain: includeChain ?? null,
  tmplStr: null,
  tmplProps: null,
  blocks: {},
  blockMeta: {},
  rootRenderFunc: null,
  compiled: false,
});

const loadSource = (state: TemplateState, src: string | TemplateSource): TemplateState => {
  if (isPlainObject(src)) {
    const srcObj = src as TemplateSource;
    switch (srcObj.type) {
      case 'code':
        return { ...state, tmplProps: srcObj.value as CompiledTemplateExports };
      case 'string':
        return { ...state, tmplStr: srcObj.value as string };
      default:
        throw createLog('error', { def: getError('TEMPLATE_INVALID_SOURCE'), params: { type: srcObj.type }, subject: srcObj.type, context: { phase: 'load' } });
    }
  }
  if (isString(src)) {
    return { ...state, tmplStr: src };
  }
  throw createLog('error', { def: getError('TEMPLATE_SRC_STRING'), params: {}, subject: null, context: { phase: 'load' } });
};
