import { isString, isPlainObject } from 'remeda';
import { createLog } from '@nunjucks/error-formatter';
import { getError } from '@nunjucks/error-catalog';
import type { Env } from '@nunjucks/runtime';
import type { IncludeChain } from '@nunjucks/error-formatter';
import type { CompiledTemplateExports } from '@nunjucks/compiler';
import type { TemplateSource, TemplateState, TemplateStateBase } from './types';

export { initTemplateState, loadSource, createFallbackEnv };

interface GetTemplateOptions {
  name: string;
  eagerCompile?: boolean;
  includeChain?: IncludeChain | null;
  ignoreMissing?: boolean;
}

const createFallbackEnv = (): Env => ({
  opts: { dev: false, autoescape: true, undefined: 'default' },
  getFilter: () => null,
  getTest: () => null,
  getTemplate(nameOrOptions: string | GetTemplateOptions) {
    const name = typeof nameOrOptions === 'string' ? nameOrOptions : nameOrOptions.name;
    const ignoreMissing = typeof nameOrOptions === 'string' ? undefined : nameOrOptions.ignoreMissing;
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

const initTemplateState = ({ src: _src, env, path, includeChain }: InitTemplateStateOptions): TemplateStateBase => ({
  env: env ?? createFallbackEnv(),
  path: path ?? undefined,
  includeChain: includeChain ?? null,
  blocks: {},
  blockMeta: {},
});

const loadSource = (base: TemplateStateBase, src: string | TemplateSource): TemplateState => {
  if (isPlainObject(src)) {
    const srcObj = src as TemplateSource;
    switch (srcObj.type) {
      case 'code':
        return { ...base, status: 'compiled', tmplStr: null, tmplProps: srcObj.value as CompiledTemplateExports, rootRenderFunc: (srcObj.value as CompiledTemplateExports).root };
      case 'string':
        return { ...base, status: 'source', tmplStr: srcObj.value as string, tmplProps: null, rootRenderFunc: null };
      default:
        throw createLog('error', { def: getError('TEMPLATE_INVALID_SOURCE'), params: { type: srcObj.type }, subject: srcObj.type, context: { phase: 'load' } });
    }
  }
  if (isString(src)) {
    return { ...base, status: 'source', tmplStr: src, tmplProps: null, rootRenderFunc: null };
  }
  throw createLog('error', { def: getError('TEMPLATE_SRC_STRING'), params: {}, subject: null, context: { phase: 'load' } });
};
