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
    throw createLog('error', getError('FILE_NOT_FOUND'), { path: name }, name, { phase: 'load' });
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
        state.tmplProps = srcObj.value as CompiledTemplateExports;
        break;
      case 'string':
        state.tmplStr = srcObj.value as string;
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
