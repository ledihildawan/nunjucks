import { isString, isPlainObject, defaultTo } from 'remeda';
import { createCompiler } from '../compiler/index.js';
import { parse } from '../parser/index.js';
import { transform } from '../transformers/index.js';
import { prettifyError } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { createLog } from '@nunjucks/log';
import { createMappedError } from '../helpers/source-map.js';
import { createContext } from '../runtime/context.js';
import { HOOK_EVENTS } from '../runtime/hooks.js';
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
  isArray,
  keys,
} from '../runtime/index.js';
import { createObj } from '../object/index.js';

const Template = Symbol('Template');

const createRuntimeWithContext = (templatePath, envOpts, renderContext = null) => {
  return {
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
  };
};

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

const createFallbackEnv = () => ({
  opts: { dev: false, autoescape: true },
  extensionsList: [],
  globals: {},
  _renderingTemplates: new Set(),
  async getTemplate(name, eagerCompile, includeChain, ignoreMissing) {
    if (ignoreMissing) return null;
    throw createLog('error', ERROR_DEFINITIONS.FILE_NOT_FOUND, { path: name }, name, { phase: 'load' });
  }
});

export function createTemplate(src, env, path, eagerCompile, includeChain) {
  const obj = createObj({
    name: 'Template',
    [Template]: true,
    init: function(srcArg, envArg, pathArg, eagerCompileArg, includeChainArg) {
      this.env = envArg || createFallbackEnv();
      this.path = pathArg;
      this._includeChain = includeChainArg || null;

      if (isPlainObject(srcArg)) {
        switch (srcArg.type) {
          case 'code':
            this.tmplProps = srcArg.obj;
            break;
          case 'string':
            this.tmplStr = srcArg.obj;
            break;
          default: {
            throw createLog('error', ERROR_DEFINITIONS.TEMPLATE_INVALID_SOURCE, { type: srcArg.type }, srcArg.type, { phase: 'load' });
          }
        }
      } else if (isString(srcArg)) {
        this.tmplStr = srcArg;
      } else {
        throw createLog('error', ERROR_DEFINITIONS.TEMPLATE_SRC_STRING, {}, null, { phase: 'load' });
      }

      if (eagerCompileArg) {
        try {
          this._compile();
        } catch (err) {
          throw prettifyError({ path: this.path, withInternals: this.env.opts.dev, err });
        }
      } else {
        this.compiled = false;
      }
    },
    render: async function(ctx, parentFrame) {
      await this._safeCompile();

      if (this.env._renderingTemplates.has(this.path)) {
        throw createLog('error', ERROR_DEFINITIONS.CIRCULAR_INCLUDE, { path: this.path }, this.path, { phase: 'render' });
      }

      this.env._renderingTemplates.add(this.path);

      const context = createContext(ctx || {}, this.blocks, this.env, { blockLocations: this.blockMeta });
      const frame = parentFrame ? parentFrame.push(true) : createFrame();
      frame.topLevel = true;

      try {
        const runtime = createRuntimeWithContext(this.path, this.env.opts, ctx || {});
        const result = await this.rootRenderFunc(this.env, context, frame, runtime);
        if (runtime.__warnings__ && runtime.__warnings__.length > 0 && this.env.opts.dev) {
          const script = injectWarningsScript(runtime.__warnings__, { dev: true, verbosity: 'medium' });
          return result + script;
        }
        return result;
      } catch (e) {
        const errorWithPath = this._enrichError(e);
        throw prettifyError({
          path: e.path || this.path,
          withInternals: this.env.opts.dev,
          err: errorWithPath,
          includeChain: e._includeChain || this._includeChain
        });
      } finally {
        this.env._renderingTemplates.delete(this.path);
      }
    },
    // ============================================
    // MODERN API: Sync render
    // ============================================
    renderSync: function(ctx, parentFrame) {
      this._safeCompileSync();

      if (this.env._renderingTemplates.has(this.path)) {
        throw createLog('error', ERROR_DEFINITIONS.CIRCULAR_INCLUDE, { path: this.path }, this.path, { phase: 'render' });
      }

      this.env._renderingTemplates.add(this.path);

      const context = createContext(ctx || {}, this.blocks, this.env, { blockLocations: this.blockMeta });
      const frame = parentFrame ? parentFrame.push(true) : createFrame();
      frame.topLevel = true;

      try {
        const runtime = createRuntimeWithContext(this.path, this.env.opts, ctx || {});
        const result = this.rootRenderFunc(this.env, context, frame, runtime);
        if (runtime.__warnings__ && runtime.__warnings__.length > 0 && this.env.opts.dev) {
          const script = injectWarningsScript(runtime.__warnings__, { dev: true, verbosity: 'medium' });
          return result + script;
        }
        return result;
      } catch (e) {
        const errorWithPath = this._enrichError(e);
        throw prettifyError({
          path: e.path || this.path,
          withInternals: this.env.opts.dev,
          err: errorWithPath,
          includeChain: e._includeChain || this._includeChain
        });
      } finally {
        this.env._renderingTemplates.delete(this.path);
      }
    },
    _safeCompileSync: function() {
      if (!this.compiled) {
        this.compile();
      }
    },
    _safeCompile: async function() {
      try {
        await this.compile();
      } catch (e) {
        throw prettifyError({ path: this.path, withInternals: this.env.opts.dev, err: e });
      }
    },
    _enrichError: function(e) {
      if (!e.path) e.path = this.path;

      const sourceLineno = e.lineno;
      const sourceColno = e.colno;
      const errorPath = e.path;
      const hasIncludeChain = e._includeChain || this._includeChain;
      let sourceMap = this.tmplProps?.__sourceMap;

      if (errorPath !== this.path && this.env && !hasIncludeChain) {
        sourceMap = getLoaderSourceMap(this.env, errorPath, this.path) || sourceMap;
      }

      const enriched = extractFrameDetails(e, sourceLineno, sourceColno, sourceMap, this.path, hasIncludeChain);
      return enriched || e;
    },
    getExported: async function(ctx, parentFrame) {
      try {
        await this.compile();
      } catch (e) {
        throw prettifyError({ path: this.path, withInternals: this.env.opts.dev, err: e, includeChain: this._includeChain });
      }

      const frame = parentFrame ? parentFrame.push() : createFrame();
      frame.topLevel = true;

      const context = createContext(ctx || {}, this.blocks, this.env, { blockLocations: this.blockMeta });
      try {
        const runtime = createRuntimeWithContext(this.path, this.env.opts, ctx || {});
        await this.rootRenderFunc(this.env, context, frame, runtime);
        return context.getExported();
      } catch (e) {
        if (!e.path) e.path = this.path;
        throw prettifyError({ path: e.path, withInternals: this.env.opts.dev, err: e, includeChain: this._includeChain });
      }
    },
    compile: async function() {
      if (!this.compiled) {
        this._compile();
      }
    },
    _compile: function() {
      const startTime = Date.now();
      this.env.emit(HOOK_EVENTS.TEMPLATE_COMPILE_START, { template: this, path: this.path });

      let props;

      try {
        if (this.tmplProps) {
          props = this.tmplProps;
        } else {
          const c = createCompiler(this.path, this.env.opts.undefined, this.tmplStr);
          const ast = parse(this.tmplStr, this.env.opts, this.path);
          const transformedAst = transform(ast, this.env.extensionsList, this.path);
          c.compile(transformedAst);
          const code = c.getCode();
          const func = new Function(code);
          props = func();
        }

        this.blocks = this._getBlocks(props);
        this.blockMeta = props.__blockMeta || {};
        this.rootRenderFunc = props.root;
        this.compiled = true;

        this.env.emit(HOOK_EVENTS.TEMPLATE_COMPILE_COMPLETE, { template: this, path: this.path, duration: Date.now() - startTime });
      } catch (error) {
        this.env.emit(HOOK_EVENTS.TEMPLATE_COMPILE_ERROR, { template: this, path: this.path, error, duration: Date.now() - startTime });
        throw error;
      }
    },
    _getBlocks: function(props) {
      const blocks = {};
      keys(props).forEach((k) => {
        if (k.slice(0, 2) === 'b_') {
          blocks[k.slice(2)] = props[k];
        }
      });
      return blocks;
    },
  });
  obj.init(src, env, path, eagerCompile);
  return obj;
}

export const isTemplate = (obj) => obj?.[Template] === true;
