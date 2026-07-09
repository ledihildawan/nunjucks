import { isString, isPlainObject } from 'remeda';
import { compile } from './compiler.js';
import { prettifyError } from './error/index.js';
import { createMappedError } from './source-map.js';
import { Context } from './context.js';
import { Frame } from './runtime.js';
import * as globalRuntime from './runtime.js';
import { Obj } from './object.js';

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

const createFallbackEnv = () => ({
  opts: { dev: false, autoescape: true },
  asyncFilters: [],
  extensionsList: [],
  globals: {},
  _renderingTemplates: new Set(),
  async getTemplate(name, eagerCompile, includeChain, ignoreMissing) {
    if (ignoreMissing) return null;
    const err = new Error('template not found: ' + name);
    err.code = 'FILE_NOT_FOUND';
    err.subject = name;
    throw err;
  }
});

export class Template extends Obj {
  init(src, env, path, eagerCompile) {
    this.env = env || createFallbackEnv();
    this.path = path;

    if (isPlainObject(src)) {
      switch (src.type) {
        case 'code':
          this.tmplProps = src.obj;
          break;
        case 'string':
          this.tmplStr = src.obj;
          break;
        default:
          throw new Error(`Unexpected template object type ${src.type}; expected 'code', or 'string'`);
      }
    } else if (isString(src)) {
      this.tmplStr = src;
    } else {
      throw new Error('src must be a string or an object describing the source');
    }

    if (eagerCompile) {
      try {
        this._compile();
      } catch (err) {
        throw prettifyError({ path: this.path, withInternals: this.env.opts.dev, err });
      }
    } else {
      this.compiled = false;
    }
  }

  async render(ctx, parentFrame) {
    try {
      await this.compile();
    } catch (e) {
      throw prettifyError({ path: this.path, withInternals: this.env.opts.dev, err: e });
    }

    if (this.env._renderingTemplates.has(this.path)) {
      const err = new Error(`Circular include detected: "${this.path}" is already being rendered`);
      err.path = this.path;
      err.code = 'CIRCULAR_INCLUDE';
      err.subject = this.path;
      throw err;
    }

    this.env._renderingTemplates.add(this.path);

    const context = new Context(ctx || {}, this.blocks, this.env);
    const frame = parentFrame ? parentFrame.push(true) : new Frame();
    frame.topLevel = true;

    try {
      return await this.rootRenderFunc(this.env, context, frame, globalRuntime);
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
  }

  _enrichError(e) {
    if (!e.path) e.path = this.path;

    const sourceLineno = e.lineno;
    const sourceColno = e.colno;
    const errorPath = e.path;
    const hasIncludeChain = e._includeChain || this._includeChain;
    let sourceMap = this.tmplProps?.__sourceMap;

    if (errorPath !== this.path && this.env && !hasIncludeChain) {
      sourceMap = getLoaderSourceMap(this.env, errorPath, this.path) || sourceMap;
    }

    if (sourceMap && !hasIncludeChain) {
      const mapped = createMappedError(e, sourceMap, sourceLineno, sourceColno, this.path);

      if (mapped) return mapped;

      if (sourceLineno !== undefined && sourceLineno > 0) {
        const errColno = e.colno || 0;
        const finalColno = (sourceColno > 0) ? sourceColno : errColno;
        const templateLocation = this.path + ':' + sourceLineno + ':' + finalColno;
        let msg = '(' + this.path + ')';
        if (sourceLineno && finalColno > 0) {
          msg += ` [Line ${sourceLineno}, Column ${finalColno}]`;
        } else if (sourceLineno) {
          msg += ` [Line ${sourceLineno}]`;
        }
        msg += '\n  ' + (e.message || '');
        const newError = new Error(msg);
        newError.name = e.name || 'Template render error';
        newError.lineno = sourceLineno;
        newError.colno = finalColno;
        newError._includeChain = e._includeChain || this._includeChain || null;
        const renderLine = 'at ' + (e.getterName || 'root') + ' (' + templateLocation + ')';
        newError.stack = newError.message + '\n    ' + renderLine + '\n    at Environment.render';
        throw newError;
      }
    }

    return e;
  }

  async getExported(ctx, parentFrame) {
    try {
      await this.compile();
    } catch (e) {
      throw prettifyError({ path: this.path, withInternals: this.env.opts.dev, err: e, includeChain: this._includeChain });
    }

    const frame = parentFrame ? parentFrame.push() : new Frame();
    frame.topLevel = true;

    const context = new Context(ctx || {}, this.blocks, this.env);
    try {
      await this.rootRenderFunc(this.env, context, frame, globalRuntime);
      return context.getExported();
    } catch (e) {
      if (!e.path) e.path = this.path;
      throw prettifyError({ path: e.path, withInternals: this.env.opts.dev, err: e, includeChain: this._includeChain });
    }
  }

  async compile() {
    if (!this.compiled) {
      this._compile();
    }
  }

  _compile() {
    let props;

    if (this.tmplProps) {
      props = this.tmplProps;
    } else {
      const source = compile(
        this.tmplStr,
        this.env.asyncFilters,
        this.env.extensionsList,
        this.path,
        this.env.opts
      );
      const func = new Function(source);
      props = func();
    }

    this.blocks = this._getBlocks(props);
    this.rootRenderFunc = props.root;
    this.compiled = true;
  }

  _getBlocks(props) {
    const blocks = {};
    Object.keys(props).forEach((k) => {
      if (k.slice(0, 2) === 'b_') {
        blocks[k.slice(2)] = props[k];
      }
    });
    return blocks;
  }
}
