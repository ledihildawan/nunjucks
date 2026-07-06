import * as lib from './lib.js';
import { compile } from './compiler.js';
import * as filters from './filters.js';
import {FileSystemLoader, WebLoader, PrecompiledLoader} from './loaders.js';
import * as tests from './tests.js';
import globals from './globals.js';
import {Obj, EmitterObj} from './object.js';
import * as globalRuntime from './runtime.js';
import {Frame} from './runtime.js';
import expressApp from './express-app.js';

const noopTmplSrc = {
  type: 'code',
  obj: {
    async root(env, context, frame, runtime) {
      return '';
    }
  }
};

export class Environment extends EmitterObj {
  init(loaders, opts) {
    opts = this.opts = opts || {};
    this.opts.dev = !!opts.dev;

    this.opts.autoescape = opts.autoescape != null ? opts.autoescape : true;

    this.opts.throwOnUndefined = !!opts.throwOnUndefined;
    this.opts.trimBlocks = !!opts.trimBlocks;
    this.opts.lstripBlocks = !!opts.lstripBlocks;

    this.loaders = [];

    if (!loaders) {
      if (FileSystemLoader) {
        this.loaders = [new FileSystemLoader('views')];
      } else if (WebLoader) {
        this.loaders = [new WebLoader('/views')];
      }
    } else {
      this.loaders = lib.isArray(loaders) ? loaders : [loaders];
    }

    if (typeof window !== 'undefined' && window.nunjucksPrecompiled) {
      this.loaders.unshift(
        new PrecompiledLoader(window.nunjucksPrecompiled)
      );
    }

    this._initLoaders();

    this.globals = globals();
    this.filters = {};
    this.tests = {};
    this.asyncFilters = [];
    this.extensions = {};
    this.extensionsList = [];

    lib._entries(filters).forEach(([name, filter]) => this.addFilter(name, filter));
    lib._entries(tests).forEach(([name, test]) => this.addTest(name, test));
  }

  _initLoaders() {
    this.loaders.forEach((loader) => {
      loader.cache = {};
      if (typeof loader.on === 'function') {
        loader.on('update', (name, fullname) => {
          loader.cache[name] = null;
          this.emit('update', name, fullname, loader);
        });
        loader.on('load', (name, source) => {
          this.emit('load', name, source, loader);
        });
      }
    });
  }

  invalidateCache() {
    this.loaders.forEach((loader) => {
      loader.cache = {};
    });
  }

  addExtension(name, extension) {
    extension.__name = name;
    this.extensions[name] = extension;
    this.extensionsList.push(extension);
    return this;
  }

  removeExtension(name) {
    var extension = this.getExtension(name);
    if (!extension) {
      return;
    }

    this.extensionsList = lib.without(this.extensionsList, extension);
    delete this.extensions[name];
  }

  getExtension(name) {
    return this.extensions[name];
  }

  hasExtension(name) {
    return !!this.extensions[name];
  }

  addGlobal(name, value) {
    this.globals[name] = value;
    return this;
  }

  getGlobal(name) {
    if (typeof this.globals[name] === 'undefined') {
      throw new Error('global not found: ' + name);
    }
    return this.globals[name];
  }

  addFilter(name, func, async) {
    var wrapped = func;

    if (async) {
      this.asyncFilters.push(name);
    }
    this.filters[name] = wrapped;
    return this;
  }

  getFilter(name) {
    if (!this.filters[name]) {
      throw new Error('filter not found: ' + name);
    }
    const filter = this.filters[name];

    if (this.asyncFilters.includes(name)) {
      return async function(...args) {
        const resolvedArgs = await Promise.all(args.map(async arg => {
          if (arg && typeof arg.then === 'function') {
            return arg.then(v => v);
          }
          return arg;
        }));
        return filter.apply(this, resolvedArgs);
      };
    }

    return function(...args) {
      if (!args.some(a => a && typeof a.then === 'function')) {
        return filter.apply(this, args);
      }
      return Promise.all(args).then(resolved => filter.apply(this, resolved));
    };
  }

  addTest(name, func) {
    this.tests[name] = func;
    return this;
  }

  getTest(name) {
    if (!this.tests[name]) {
      throw new Error('test not found: ' + name);
    }
    return this.tests[name];
  }

  resolveTemplate(loader, parentName, filename) {
    var isRelative = (loader.isRelative && parentName) ? loader.isRelative(filename) : false;
    return (isRelative && loader.resolve) ? loader.resolve(parentName, filename) : filename;
  }

  async getTemplate(name, eagerCompile, includeChain, ignoreMissing) {
    var tmpl = null;
    var parentName = null;
    if (includeChain && typeof includeChain === 'object') {
      parentName = includeChain.parentTmpl;
    } else if (typeof includeChain === 'string') {
      parentName = includeChain;
      includeChain = null;
    }

    if (name && name.raw) {
      name = name.raw;
    }

    if (name instanceof Template) {
      tmpl = name;
    } else if (typeof name !== 'string') {
      throw new Error('template names must be a string: ' + name);
    } else {
      for (let i = 0; i < this.loaders.length; i++) {
        const loader = this.loaders[i];
        tmpl = loader.cache[this.resolveTemplate(loader, parentName, name)];
        if (tmpl) {
          break;
        }
      }
    }

    if (tmpl) {
      if (!includeChain) {
        tmpl._includeChain = null;
      } else {
        tmpl._includeChain = includeChain;
      }
      if (eagerCompile) {
        tmpl.compile();
      }
      return tmpl;
    }

    let info = null;
    for (let i = 0; i < this.loaders.length; i++) {
      const loader = this.loaders[i];
      const resolvedName = this.resolveTemplate(loader, parentName, name);

      let src;
      if (loader.async) {
        src = await loader.getSource(resolvedName);
      } else {
        src = loader.getSource(resolvedName);
      }

      if (src) {
        src.loader = loader;
        info = src;
        break;
      }
    }

    if (!info && !ignoreMissing) {
      throw new Error('template not found: ' + name);
    }

    if (!info) {
      const emptyTmpl = new Template(noopTmplSrc, this, '', eagerCompile);
      if (includeChain) {
        emptyTmpl._includeChain = includeChain;
      }
      return emptyTmpl;
    }

    const newTmpl = new Template(info.src, this, info.path, eagerCompile);
    if (includeChain) {
      newTmpl._includeChain = includeChain;
    }
    if (!info.noCache) {
      info.loader.cache[name] = newTmpl;
    }
    return newTmpl;
  }

  express(app) {
    return expressApp(this, app);
  }

  async render(name, ctx) {
    const tmpl = await this.getTemplate(name);
    const result = await tmpl.render(ctx);
    return result;
  }

  async renderString(src, ctx, opts) {
    opts = opts || {};
    const tmpl = new Template(src, this, opts.path);
    return await tmpl.render(ctx);
  }
}

class Context extends Obj {
  init(ctx, blocks, env) {
    this.env = env || new Environment();

    this.ctx = lib.extend({}, ctx);

    this.blocks = {};
    this.exported = [];

    lib.keys(blocks).forEach(name => {
      this.addBlock(name, blocks[name]);
    });
  }

  lookup(name) {
    if (name in this.env.globals && !(name in this.ctx)) {
      return this.env.globals[name];
    } else {
      return this.ctx[name];
    }
  }

  setVariable(name, val) {
    this.ctx[name] = val;
  }

  getVariables() {
    return this.ctx;
  }

  addBlock(name, block) {
    this.blocks[name] = this.blocks[name] || [];
    this.blocks[name].push(block);
    return this;
  }

  getBlock(name) {
    if (!this.blocks[name]) {
      throw new Error('unknown block "' + name + '"');
    }

    return this.blocks[name][0];
  }

  getSuper(env, name, block, frame, runtime) {
    var idx = lib.indexOf(this.blocks[name] || [], block);
    var blk = this.blocks[name][idx + 1];
    var context = this;

    if (idx === -1 || !blk) {
      throw new Error('no super block available for "' + name + '"');
    }

    return blk(env, context, frame, runtime);
  }

  addExport(name) {
    this.exported.push(name);
  }

  getExported() {
    var exported = {};
    this.exported.forEach((name) => {
      exported[name] = this.ctx[name];
    });
    return exported;
  }
}

export class Template extends Obj {
  init(src, env, path, eagerCompile) {
    this.env = env || new Environment();

    if (lib.isObject(src)) {
      switch (src.type) {
        case 'code':
          this.tmplProps = src.obj;
          break;
        case 'string':
          this.tmplStr = src.obj;
          break;
        default:
          throw new Error(
            `Unexpected template object type ${src.type}; expected 'code', or 'string'`);
      }
    } else if (lib.isString(src)) {
      this.tmplStr = src;
    } else {
      throw new Error('src must be a string or an object describing the source');
    }

    this.path = path;

    if (eagerCompile) {
      try {
        this._compile();
      } catch (err) {
        throw lib._prettifyError(this.path, this.env.opts.dev, err);
      }
    } else {
      this.compiled = false;
    }
  }

  async render(ctx, parentFrame) {
    try {
      this.compile();
    } catch (e) {
      throw lib._prettifyError(this.path, this.env.opts.dev, e);
    }

    const context = new Context(ctx || {}, this.blocks, this.env);
    const frame = parentFrame ? parentFrame.push(true) : new Frame();
    frame.topLevel = true;

    try {
      const result = await this.rootRenderFunc(this.env, context, frame, globalRuntime);
      return result;
    } catch (e) {
      let sourceLineno = e.lineno;
      let sourceColno = e.colno;

      const errorPath = e.path || this.path;
      const isIncludeError = e.message && e.message.includes('(included from');

      if (!isIncludeError) {
        let sourceMap = this.tmplProps?.__sourceMap;

        if (errorPath !== this.path && this.env) {
          const loaders = this.env.loaders || [];
          for (const loader of loaders) {
            if (loader._getSourceMap) {
              const loaderMap = loader._getSourceMap(errorPath);
              if (loaderMap) {
                sourceMap = loaderMap;
                break;
              }
            }
          }
        }

        if (sourceMap) {
          let bestMapping = null;
          for (const mapping of sourceMap) {
            if (sourceLineno >= mapping.compiledLine) {
              bestMapping = mapping;
            }
          }
          if (bestMapping) {
            const offset = sourceLineno - bestMapping.compiledLine;
            sourceLineno = bestMapping.originalLine + offset;
            sourceColno = bestMapping.originalCol || 0;
          }
        }
      }

      if (sourceLineno !== undefined && sourceLineno > 0) {
        const templateLocation = this.path + ':' + sourceLineno + ':' + sourceColno;
        let msg = '(' + this.path + ')';
        if (sourceLineno && sourceColno) {
          msg += ` [Line ${sourceLineno}, Column ${sourceColno}]`;
        } else if (sourceLineno) {
          msg += ` [Line ${sourceLineno}]`;
        }
        msg += '\n  ' + (e.message || '');
        const newError = new Error(msg);
        newError.name = e.name || 'Template render error';
        newError.lineno = sourceLineno;
        newError.colno = sourceColno;
        newError._includeChain = e._includeChain || this._includeChain || null;
        const renderLine = 'at ' + (e.getterName || 'root') + ' (' + templateLocation + ')';
        newError.stack = newError.message + '\n    ' + renderLine + '\n    at Environment.render';
        throw newError;
      }

      throw lib._prettifyError(this.path, this.env.opts.dev, e, e._includeChain || this._includeChain);
    }
  }

  async getExported(ctx, parentFrame) {
    try {
      this.compile();
    } catch (e) {
      throw lib._prettifyError(this.path, this.env.opts.dev, e, e._includeChain || this._includeChain);
    }

    const frame = parentFrame ? parentFrame.push() : new Frame();
    frame.topLevel = true;

    const context = new Context(ctx || {}, this.blocks, this.env);
    try {
      await this.rootRenderFunc(this.env, context, frame, globalRuntime);
      return context.getExported();
    } catch (e) {
      throw lib._prettifyError(this.path, this.env.opts.dev, e, e._includeChain || this._includeChain);
    }
  }

  compile() {
    if (!this.compiled) {
      this._compile();
    }
  }

  _compile() {
    var props;

    if (this.tmplProps) {
      props = this.tmplProps;
    } else {
      const source = compile(this.tmplStr,
        this.env.asyncFilters,
        this.env.extensionsList,
        this.path,
        this.env.opts);

      const func = new Function(source);
      props = func();
    }

    this.blocks = this._getBlocks(props);
    this.rootRenderFunc = props.root;
    this.compiled = true;
  }

  _getBlocks(props) {
    var blocks = {};

    lib.keys(props).forEach((k) => {
      if (k.slice(0, 2) === 'b_') {
        blocks[k.slice(2)] = props[k];
      }
    });

    return blocks;
  }
}
