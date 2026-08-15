import { getError } from '@nunjucks/error-catalog';
import type { IncludeChain } from '@nunjucks/error-formatter';
import { createLog } from '@nunjucks/error-formatter';
import type { Env } from '@nunjucks/runtime';
import { isCompiledTemplateExports } from '@nunjucks/shared';
import { isPlainObject, isString } from 'remeda';
import type { TemplateSource, TemplateState, TemplateStateBase } from './types';

export { createFallbackEnv, initTemplateState, loadSource };

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
  getTemplate({ name, ignoreMissing }: GetTemplateOptions) {
    if (ignoreMissing) {
      return null;
    }
    throw createLog('error', {
      def: getError('FILE_NOT_FOUND'),
      params: { path: name },
      subject: name,
      context: { phase: 'load' },
    });
  },
});

interface InitTemplateStateOptions {
  src: string | TemplateSource;
  env: Env | undefined;
  path: string | null | undefined;
  includeChain: IncludeChain | null | undefined;
}

const initTemplateState = ({
  src: _src,
  env,
  path,
  includeChain,
}: InitTemplateStateOptions): TemplateStateBase => ({
  env: env ?? createFallbackEnv(),
  path: path ?? undefined,
  includeChain: includeChain ?? null,
  blocks: {},
  blockMeta: {},
});

const loadSource = (base: TemplateStateBase, src: string | TemplateSource): TemplateState => {
  if (isPlainObject(src)) {
    // WHY: cast is boundary defense — JS callers can pass any object shape; the runtime
    // checks below stay authoritative even though the static type now carries the payload.
    const srcObj = src as TemplateSource;
    switch (srcObj.type) {
      case 'code':
        if (!isCompiledTemplateExports(srcObj.value)) {
          throw createLog('error', {
            def: getError('TEMPLATE_INVALID_SOURCE'),
            params: { type: 'code (value is not compiled template exports)' },
            subject: 'code',
            context: { phase: 'load' },
          });
        }
        return {
          ...base,
          status: 'compiled',
          tmplStr: null,
          tmplProps: srcObj.value,
          rootRenderFunc: srcObj.value.root,
        };
      case 'string':
        if (typeof srcObj.value !== 'string') {
          throw createLog('error', {
            def: getError('TEMPLATE_INVALID_SOURCE'),
            params: { type: 'string (value is not a string)' },
            subject: 'string',
            context: { phase: 'load' },
          });
        }
        return {
          ...base,
          status: 'source',
          tmplStr: srcObj.value,
          tmplProps: null,
          rootRenderFunc: null,
        };
      default:
        throw createLog('error', {
          def: getError('TEMPLATE_INVALID_SOURCE'),
          params: { type: (srcObj as { type: string }).type },
          subject: (srcObj as { type: string }).type,
          context: { phase: 'load' },
        });
    }
  }
  if (isString(src)) {
    return { ...base, status: 'source', tmplStr: src, tmplProps: null, rootRenderFunc: null };
  }
  throw createLog('error', {
    def: getError('TEMPLATE_SRC_STRING'),
    params: {},
    subject: null,
    context: { phase: 'load' },
  });
};
