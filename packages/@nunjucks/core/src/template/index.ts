import { isString, isPlainObject, defaultTo, isArray, keys } from 'remeda';
import { createCompiler } from '@nunjucks/compiler';
import { parse } from '@nunjucks/parser';
import type { ParseOptions } from '@nunjucks/parser';
import type { UndefinedMode } from '@nunjucks/runtime/undefined';
import { transform } from '@nunjucks/transformers';
import { prettifyError, getError } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';
import { createContext } from '@nunjucks/runtime/context';
import type { ContextEnv, BlockLocation } from '@nunjucks/runtime/context';
import { HOOK_EVENTS } from '@nunjucks/runtime/hooks';
import { injectWarningsScript } from '@nunjucks/log';
import type { Warning, IncludeChain } from '@nunjucks/log';
import {
  createFrame,
  createSafeString,
  copySafeness,
  markSafe,
  makeMacro,
  makeKeywordArgs,
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
  suppressValue,
  awaitValue,
  ensureDefined,
  callWrap,
  contextOrFrameLookup,
  handleError,
  fromIterator,
  inOperator,
} from '@nunjucks/runtime';
import type { Frame } from '@nunjucks/runtime';
import { createEnv } from '../core/env.ts';
import { extractBlocks } from '@nunjucks/shared';
import type { Env } from '../core/env.ts';

const Template = Symbol('Template');

interface RuntimeContext {
  createFrame: typeof createFrame;
  createSafeString: typeof createSafeString;
  copySafeness: typeof copySafeness;
  markSafe: typeof markSafe;
  makeMacro: typeof makeMacro;
  makeKeywordArgs: typeof makeKeywordArgs;
  memberLookup: typeof memberLookup;
  optionalMemberLookup: typeof optionalMemberLookup;
  slice: typeof slice;
  nullishCoalesce: typeof nullishCoalesce;
  suppressValue: typeof suppressValue;
  awaitValue: typeof awaitValue;
  ensureDefined: typeof ensureDefined;
  callWrap: typeof callWrap;
  contextOrFrameLookup: typeof contextOrFrameLookup;
  handleError: typeof handleError;
  fromIterator: typeof fromIterator;
  inOperator: typeof inOperator;
  isArray: typeof isArray;
  keys: typeof keys;
  __warnings__: unknown[];
  logContext: {
    templateName: string;
    phase: string;
    renderContext: unknown;
  };
}

interface TemplateState {
  env: Env;
  path: string | undefined;
  _includeChain: unknown[] | null;
  tmplStr: string | null;
  tmplProps: Record<string, unknown> | null;
  blocks: Record<string, (...args: unknown[]) => unknown>;
  blockMeta: Record<string, unknown>;
  rootRenderFunc: ((env: Env, context: unknown, frame: unknown, runtime: RuntimeContext) => unknown) | null;
  compiled: boolean;
  compiler?: {
    compile: () => void;
    safeCompile: () => Promise<void>;
  
  };
}

interface TemplateSource {
  type: 'code' | 'string';
  obj: unknown;
}

interface TemplateObject {
  [Template]: true;
  env: Env;
  path: string | undefined;
  compiled: boolean;
  blocks: Record<string, (...args: unknown[]) => unknown>;
  blockMeta: Record<string, unknown>;
  rootRenderFunc: ((env: Env, context: unknown, frame: unknown, runtime: RuntimeContext) => unknown) | null;
  render: (ctx: unknown, parentFrame?: unknown) => Promise<string>;

  compile: () => void;
  getExported: (ctx?: unknown, parentFrame?: unknown) => Promise<Record<string, unknown>>;
}

const createRuntimeWithContext = (templatePath: string | undefined, _envOpts: Record<string, unknown>, renderContext: unknown = null): RuntimeContext => ({
  createFrame,
  createSafeString,
  copySafeness,
  markSafe,
  makeMacro,
  makeKeywordArgs,
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
  suppressValue,
  awaitValue,
  ensureDefined,
  callWrap,
  contextOrFrameLookup,
  handleError,
  fromIterator,
  inOperator,
  isArray,
  keys,
  __warnings__: [],
  logContext: {
    templateName: templatePath || 'inline',
    phase: 'render',
    renderContext
  }
});

interface ErrorWithLineInfo {
  lineBase?: string;
  colno?: number;
  lineno?: number;
  message?: string;
  name?: string;
  path?: string;
  _includeChain?: unknown[];
  getterName?: string;
  [key: string]: unknown;
}

const extractFrameDetails = (
  e: ErrorWithLineInfo,
  sourceLineno: number | undefined,
  sourceColno: number | undefined,
  currentPath: string | undefined,
  hasIncludeChain: unknown
): Error | null => {
  if (hasIncludeChain) { return null; }
  if (e.lineBase === 'zero' || e.lineBase === 'one') { return null; }
  if (sourceLineno === undefined) { return null; }
  if (sourceLineno < 0) { return null; }

  const errColno = defaultTo(e.colno, 0);
  let finalColno: number;
  if (sourceColno && sourceColno > 0) {
    finalColno = sourceColno;
  } else {
    finalColno = errColno;
  }
  const templateLocation = `${currentPath}:${sourceLineno}:${finalColno}`;
  let msg = `(${currentPath})`;
  if (sourceLineno && finalColno > 0) {
    msg += ` [Line ${sourceLineno}, Column ${finalColno}]`;
  } else if (sourceLineno) {
    msg += ` [Line ${sourceLineno}]`;
  }
  msg += `\n  ${defaultTo(e.message, '')}`;
  const newError = new Error(msg) as Error & Record<string, unknown>;
  newError.name = defaultTo(e.name, 'Template render error');
  newError.lineno = sourceLineno;
  newError.colno = finalColno;
  newError.lineBase = 'zero';
  newError._includeChain = e._includeChain || null;
  const renderLine = `at ${e.getterName || 'root'} (${templateLocation})`;
  newError.stack = `${newError.message}\n    ${renderLine}\n    at Environment.render`;
  return newError;
};

const createFallbackEnv = (): Env => createEnv({
  opts: { dev: false, autoescape: true },
  globals: {},
  async getTemplate(name: string, _eagerCompile?: boolean, _includeChain?: unknown, ignoreMissing?: boolean) {
    if (ignoreMissing) { return null; }
    throw createLog('error', getError('FILE_NOT_FOUND'), { path: name }, name, { phase: 'load' });
  }
});

const createTemplateErrorHandler = (state: TemplateState) => {
  const enrichError = (e: ErrorWithLineInfo) => {
    if (!e.path) { e.path = state.path; }

    const sourceLineno = e.lineno;
    const sourceColno = e.colno;
    const hasIncludeChain = e._includeChain || state._includeChain;

    return extractFrameDetails(e, sourceLineno, sourceColno, state.path, hasIncludeChain) || e;
  };

  return { enrichError };
};

const createTemplateCompiler = (state: TemplateState) => {
  const compile = () => {
    const startTime = Date.now();
    state.env.emit?.(HOOK_EVENTS.TEMPLATE_COMPILE_START, { template: state, path: state.path });

    try {
      let props: Record<string, unknown> | null;
      if (state.tmplProps) {
        props = state.tmplProps;
      } else {
        const c = createCompiler(state.path || '', state.env.opts.undefined as UndefinedMode | undefined, state.tmplStr || '');
        // NOTE: `parse` is (src, extensions, opts) and `transform` is (ast).
        // Both were previously called through `as any` with the arguments in
        // the wrong slots -- env.opts landed on `extensions` and the path on
        // `opts` -- which silently disabled parser extensions and lexer options.
        const ast = parse(state.tmplStr || '', [], state.env.opts as ParseOptions);
        const transformedAst = transform(ast);
        c.compile(transformedAst);
        const code = c.getCode();
        props = new Function(code)() as Record<string, unknown> | null;
       }

      state.blocks = extractBlocks(props as Record<string, unknown>) as Record<string, (...args: unknown[]) => unknown>;
      state.blockMeta = (props?.__blockMeta || {}) as Record<string, unknown>;
      state.rootRenderFunc = props?.root as typeof state.rootRenderFunc;
      state.compiled = true;

      state.env.emit?.(HOOK_EVENTS.TEMPLATE_COMPILE_COMPLETE, { template: state, path: state.path, duration: Date.now() - startTime });
    } catch (error) {
      state.env.emit?.(HOOK_EVENTS.TEMPLATE_COMPILE_ERROR, { template: state, path: state.path, error, duration: Date.now() - startTime });
      throw error;
    }
  };

  const safeCompile = async () => {
    try {
      compile();
    } catch (e) {
      throw prettifyError({ path: state.path, withInternals: state.env.opts.dev, err: e as Error });
    }
  };

  return { compile, safeCompile };
};

const createTemplateRenderer = (state: TemplateState, errorHandler: ReturnType<typeof createTemplateErrorHandler>) => {
  const { enrichError } = errorHandler;

  const render = async (ctx: unknown, parentFrame?: unknown) => {
    await state.compiler?.safeCompile();

    if (state.env._renderingTemplates.has(state.path!)) {
      throw createLog('error', getError('CIRCULAR_INCLUDE'), { path: state.path as string }, state.path as string, { phase: 'render' });
    }

    state.env._renderingTemplates.add(state.path!);

    const context = createContext(
      (ctx || {}) as Record<string, unknown>,
      state.blocks,
      state.env as unknown as ContextEnv,
      { blockLocations: state.blockMeta as Record<string, BlockLocation> }
    );
    let frame: ReturnType<Frame['push']>;
    if (parentFrame) {
      frame = (parentFrame as Pick<Frame, 'push'>).push(true);
    } else {
      frame = createFrame();
    }
    frame.topLevel = true;

    try {
      const runtime = createRuntimeWithContext(state.path, state.env.opts, ctx || {});
      const result = await state.rootRenderFunc?.(state.env, context, frame, runtime);
      if (runtime.__warnings__.length > 0 && state.env.opts.dev) {
        return result + injectWarningsScript(runtime.__warnings__ as Warning[], { dev: true, verbosity: 'medium' });
      }
      return result as string;
    } catch (e) {
      throw prettifyError({
        path: (e as Record<string, unknown>).path as string || state.path,
        withInternals: state.env.opts.dev,
        err: enrichError(e as ErrorWithLineInfo) as unknown as Error,
        includeChain: ((e as Record<string, unknown>)._includeChain as IncludeChain | undefined) || (state._includeChain as unknown as IncludeChain | undefined)
      });
    } finally {
      state.env._renderingTemplates.delete(state.path!);
    }
  };

  return { render };
};

export function createTemplate(src: string | TemplateSource, env?: Env, path?: string | null, eagerCompile?: boolean, includeChain?: unknown[] | null): TemplateObject {
  const state: TemplateState = {
    env: env || createFallbackEnv(),
    path: path ?? undefined,
    _includeChain: includeChain ?? null,
    tmplStr: null,
    tmplProps: null,
    blocks: {},
    blockMeta: {},
    rootRenderFunc: null,
    compiled: false,
  };

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

  const errorHandler = createTemplateErrorHandler(state);
  state.compiler = createTemplateCompiler(state);
  const renderer = createTemplateRenderer(state, errorHandler);

  if (eagerCompile) {
    try {
      state.compiler.compile();
    } catch (err) {
      throw prettifyError({ path: state.path, withInternals: state.env.opts.dev, err: err as Error });
    }
  }

  const template: TemplateObject = {
    [Template]: true,
    get env() { return state.env; },
    get path() { return state.path; },
    get compiled() { return state.compiled; },
    get blocks() { return state.blocks; },
    get blockMeta() { return state.blockMeta; },
    get rootRenderFunc() { return state.rootRenderFunc; },
    render: renderer.render,
    compile: () => state.compiler?.compile(),
    getExported: async (ctx?: unknown, parentFrame?: unknown) => {
      try {
        await state.compiler?.safeCompile();
      } catch (e) {
        throw prettifyError({ path: state.path, withInternals: state.env.opts.dev, err: e as Error, includeChain: state._includeChain as unknown as IncludeChain | undefined });
      }

      let frame: ReturnType<Frame['push']>;
      if (parentFrame) {
        frame = (parentFrame as Pick<Frame, 'push'>).push();
      } else {
        frame = createFrame();
      }
      frame.topLevel = true;

      const context = createContext(
      (ctx || {}) as Record<string, unknown>,
      state.blocks,
      state.env as unknown as ContextEnv,
      { blockLocations: state.blockMeta as Record<string, BlockLocation> }
    );
      try {
        const runtime = createRuntimeWithContext(state.path, state.env.opts, ctx || {});
        await state.rootRenderFunc?.(state.env, context, frame, runtime);
        return context.getExported();
      } catch (e) {
        if (!(e as Record<string, unknown>).path) { (e as Record<string, unknown>).path = state.path || undefined; }
        throw prettifyError({ path: (e as Record<string, unknown>).path as string, withInternals: state.env.opts.dev, err: e as Error, includeChain: state._includeChain as unknown as IncludeChain | undefined });
      }
    },
  };

  return template;
}

export const isTemplate = (obj: unknown): obj is TemplateObject => Boolean(obj && typeof obj === 'object' && (obj as Record<string, unknown>)[Template as unknown as string] === true);
