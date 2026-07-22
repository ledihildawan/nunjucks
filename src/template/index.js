import { isString, isPlainObject, defaultTo, isArray, keys } from 'remeda';
import { createCompiler } from '@nunjucks/compiler';
import { parse } from '@nunjucks/parser';
import { transform } from '@nunjucks/transformers';
import { prettifyError } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';
import { createMappedError } from '../helpers/source-map.js';
import { createContext } from '@nunjucks/runtime/context';
import { HOOK_EVENTS } from '@nunjucks/runtime/hooks';
import { injectWarningsScript } from '@nunjucks/log';
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
import { createEnv, extractBlocks } from '../core/env.js';

const Template = Symbol('Template');

const createRuntimeWithContext = (templatePath, envOpts, renderContext = null) => ({
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

const getLoaderSourceMap = (env, errorPath, currentPath) => {
  if (errorPath === currentPath || !env?.loaders) return null;

  for (const loader of env.loaders) {
    if (loader._getSourceMap) {
      const loaderMap = loader._getSourceMap(errorPath);
      if (loaderMap) return loaderMap;
    }
  }
  return null;
};

const extractFrameDetails = (e, sourceLineno, sourceColno, sourceMap, currentPath, hasIncludeChain) => {
  if (!sourceMap || hasIncludeChain) return null;
  if (e.lineBase === 'zero' || e.lineBase === 'one') return null;

  const mapped = createMappedError(e, sourceMap, sourceLineno, sourceColno, currentPath);
  if (mapped) return mapped;

  if (sourceLineno === undefined || sourceLineno < 0) return null;

  const errColno = defaultTo(e.colno, 0);
  const finalColno = (sourceColno > 0) ? sourceColno : errColno;
  const templateLocation = `${currentPath}:${sourceLineno}:${finalColno}`;
  let msg = `(${currentPath})`;
  if (sourceLineno && finalColno > 0) {
    msg += ` [Line ${sourceLineno}, Column ${finalColno}]`;
  } else if (sourceLineno) {
    msg += ` [Line ${sourceLineno}]`;
  }
  msg += '\n  ' + defaultTo(e.message, '');
  const newError = new Error(msg);
  newError.name = defaultTo(e.name, 'Template render error');
  newError.lineno = sourceLineno;
  newError.colno = finalColno;
  newError.lineBase = 'zero';
  newError._includeChain = e._includeChain || null;
  const renderLine = `at ${e.getterName || 'root'} (${templateLocation})`;
  newError.stack = `${newError.message}\n    ${renderLine}\n    at Environment.render`;
  return newError;
};

const createFallbackEnv = () => createEnv({
  opts: { dev: false, autoescape: true },
  globals: {},
  async getTemplate(name, eagerCompile, includeChain, ignoreMissing) {
    if (ignoreMissing) return null;
    throw createLog('error', ERROR_DEFINITIONS.FILE_NOT_FOUND, { path: name }, name, { phase: 'load' });
  }
});

const createTemplateErrorHandler = (state) => {
  const enrichError = (e) => {
    if (!e.path) e.path = state.path;

    const sourceLineno = e.lineno;
    const sourceColno = e.colno;
    const errorPath = e.path;
    const hasIncludeChain = e._includeChain || state._includeChain;
    let sourceMap = state.tmplProps?.__sourceMap;

    if (errorPath !== state.path && state.env && !hasIncludeChain) {
      sourceMap = getLoaderSourceMap(state.env, errorPath, state.path) || sourceMap;
    }

    return extractFrameDetails(e, sourceLineno, sourceColno, sourceMap, state.path, hasIncludeChain) || e;
  };

  return { enrichError };
};

const createTemplateCompiler = (state) => {
  const compile = () => {
    const startTime = Date.now();
    state.env.emit(HOOK_EVENTS.TEMPLATE_COMPILE_START, { template: state, path: state.path });

    try {
      let props;
      if (state.tmplProps) {
        props = state.tmplProps;
      } else {
        const c = createCompiler(state.path, state.env.opts.undefined, state.tmplStr);
        const ast = parse(state.tmplStr, state.env.opts, state.path);
        const transformedAst = transform(ast, state.env.extensionsList, state.path);
        c.compile(transformedAst);
        const code = c.getCode();
        props = new Function(code)();
      }

      state.blocks = extractBlocks(props);
      state.blockMeta = props.__blockMeta || {};
      state.rootRenderFunc = props.root;
      state.compiled = true;

      state.env.emit(HOOK_EVENTS.TEMPLATE_COMPILE_COMPLETE, { template: state, path: state.path, duration: Date.now() - startTime });
    } catch (error) {
      state.env.emit(HOOK_EVENTS.TEMPLATE_COMPILE_ERROR, { template: state, path: state.path, error, duration: Date.now() - startTime });
      throw error;
    }
  };

  const safeCompile = async () => {
    try {
      compile();
    } catch (e) {
      throw prettifyError({ path: state.path, withInternals: state.env.opts.dev, err: e });
    }
  };

  const safeCompileSync = () => {
    if (!state.compiled) {
      compile();
    }
  };

  return { compile, safeCompile, safeCompileSync };
};

const createTemplateRenderer = (state, errorHandler) => {
  const { enrichError } = errorHandler;

  const render = async (ctx, parentFrame) => {
    await state.compiler.safeCompile();

    if (state.env._renderingTemplates.has(state.path)) {
      throw createLog('error', ERROR_DEFINITIONS.CIRCULAR_INCLUDE, { path: state.path }, state.path, { phase: 'render' });
    }

    state.env._renderingTemplates.add(state.path);

    const context = createContext(ctx || {}, state.blocks, state.env, { blockLocations: state.blockMeta });
    const frame = parentFrame ? parentFrame.push(true) : createFrame();
    frame.topLevel = true;

    try {
      const runtime = createRuntimeWithContext(state.path, state.env.opts, ctx || {});
      const result = await state.rootRenderFunc(state.env, context, frame, runtime);
      if (runtime.__warnings__?.length > 0 && state.env.opts.dev) {
        return result + injectWarningsScript(runtime.__warnings__, { dev: true, verbosity: 'medium' });
      }
      return result;
    } catch (e) {
      throw prettifyError({
        path: e.path || state.path,
        withInternals: state.env.opts.dev,
        err: enrichError(e),
        includeChain: e._includeChain || state._includeChain
      });
    } finally {
      state.env._renderingTemplates.delete(state.path);
    }
  };

  const renderSync = (ctx, parentFrame) => {
    state.compiler.safeCompileSync();

    if (state.env._renderingTemplates.has(state.path)) {
      throw createLog('error', ERROR_DEFINITIONS.CIRCULAR_INCLUDE, { path: state.path }, state.path, { phase: 'render' });
    }

    state.env._renderingTemplates.add(state.path);

    const context = createContext(ctx || {}, state.blocks, state.env, { blockLocations: state.blockMeta });
    const frame = parentFrame ? parentFrame.push(true) : createFrame();
    frame.topLevel = true;

    try {
      const runtime = createRuntimeWithContext(state.path, state.env.opts, ctx || {});
      const result = state.rootRenderFunc(state.env, context, frame, runtime);
      if (runtime.__warnings__?.length > 0 && state.env.opts.dev) {
        return result + injectWarningsScript(runtime.__warnings__, { dev: true, verbosity: 'medium' });
      }
      return result;
    } catch (e) {
      throw prettifyError({
        path: e.path || state.path,
        withInternals: state.env.opts.dev,
        err: enrichError(e),
        includeChain: e._includeChain || state._includeChain
      });
    } finally {
      state.env._renderingTemplates.delete(state.path);
    }
  };

  return { render, renderSync };
};

export function createTemplate(src, env, path, eagerCompile, includeChain) {
  const state = {
    env: env || createFallbackEnv(),
    path,
    _includeChain: includeChain || null,
    tmplStr: null,
    tmplProps: null,
    blocks: {},
    blockMeta: {},
    rootRenderFunc: null,
    compiled: false,
  };

  if (isPlainObject(src)) {
    switch (src.type) {
      case 'code':
        state.tmplProps = src.obj;
        break;
      case 'string':
        state.tmplStr = src.obj;
        break;
      default:
        throw createLog('error', ERROR_DEFINITIONS.TEMPLATE_INVALID_SOURCE, { type: src.type }, src.type, { phase: 'load' });
    }
  } else if (isString(src)) {
    state.tmplStr = src;
  } else {
    throw createLog('error', ERROR_DEFINITIONS.TEMPLATE_SRC_STRING, {}, null, { phase: 'load' });
  }

  const errorHandler = createTemplateErrorHandler(state);
  state.compiler = createTemplateCompiler(state);
  const renderer = createTemplateRenderer(state, errorHandler);

  if (eagerCompile) {
    try {
      state.compiler.compile();
    } catch (err) {
      throw prettifyError({ path: state.path, withInternals: state.env.opts.dev, err });
    }
  }

  const template = {
    [Template]: true,
    get env() { return state.env; },
    get path() { return state.path; },
    get compiled() { return state.compiled; },
    get blocks() { return state.blocks; },
    get blockMeta() { return state.blockMeta; },
    get rootRenderFunc() { return state.rootRenderFunc; },
    render: renderer.render,
    renderSync: renderer.renderSync,
    compile: () => state.compiler.compile(),
    getExported: async (ctx, parentFrame) => {
      try {
        await state.compiler.safeCompile();
      } catch (e) {
        throw prettifyError({ path: state.path, withInternals: state.env.opts.dev, err: e, includeChain: state._includeChain });
      }

      const frame = parentFrame ? parentFrame.push() : createFrame();
      frame.topLevel = true;

      const context = createContext(ctx || {}, state.blocks, state.env, { blockLocations: state.blockMeta });
      try {
        const runtime = createRuntimeWithContext(state.path, state.env.opts, ctx || {});
        await state.rootRenderFunc(state.env, context, frame, runtime);
        return context.getExported();
      } catch (e) {
        if (!e.path) e.path = state.path;
        throw prettifyError({ path: e.path, withInternals: state.env.opts.dev, err: e, includeChain: state._includeChain });
      }
    },
  };

  return template;
}

export const isTemplate = (obj) => obj?.[Template] === true;
