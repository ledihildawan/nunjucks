import asap from 'asap';
import waterfall from 'a-sync-waterfall';
import lib from './lib.js';
import { compile } from './compiler.js';
import * as filters from './filters.js';
import {FileSystemLoader, WebLoader, PrecompiledLoader} from './loaders.js';
import * as tests from './tests.js';
import globals from './globals.js';
import {Obj, EmitterObj} from './object.js';
import * as globalRuntime from './runtime.js';
import {handleError, Frame} from './runtime.js';
import expressApp from './express-app.js';

function callbackAsap(cb, err, res) {
  asap(() => {
    cb(err, res);
  });
}

const noopTmplSrc = {
  type: 'code',
  obj: {
    root(env, context, frame, runtime, cb) {
      if (typeof cb === 'function') {
        try {
          cb(null, '');
        } catch (e) {
          cb(handleError(e, null, null));
        }
      } else {
        return Promise.resolve('');
      }
    }
  }
};

class Environment extends EmitterObj {
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
    const isAsync = this.asyncFilters.includes(name);

    if (isAsync) {
      return function(...args) {
        return new Promise((resolve, reject) => {
          const cb = (err, result) => {
            if (err) reject(err);
            else resolve(result);
          };
          filter.apply(this, [...args, cb]);
        });
      };
    }

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

  getTemplate(name, eagerCompile, parentName, ignoreMissing, cb) {
    var that = this;
    var tmpl = null;
    if (name && name.raw) {
      name = name.raw;
    }

    if (lib.isFunction(parentName)) {
      cb = parentName;
      parentName = null;
      eagerCompile = eagerCompile || false;
    }

    if (lib.isFunction(eagerCompile)) {
      cb = eagerCompile;
      eagerCompile = false;
    }

    if (!cb) {
      return this._getTemplateAsync(name, eagerCompile, parentName, ignoreMissing);
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
      if (eagerCompile) {
        tmpl.compile();
      }
      cb(null, tmpl);
      return undefined;
    }

    lib.asyncIter(this.loaders, (loader, i, next, done) => {
      function handle(err, src) {
        if (err) {
          done(err);
        } else if (src) {
          src.loader = loader;
          done(null, src);
        } else {
          next();
        }
      }

      name = that.resolveTemplate(loader, parentName, name);

      if (loader.async) {
        loader.getSource(name, handle);
      } else {
        handle(null, loader.getSource(name));
      }
    }, (err, info) => {
      if (!info && !err && !ignoreMissing) {
        err = new Error('template not found: ' + name);
      }
      if (err) {
        cb(err);
        return;
      }
      let newTmpl;
      if (!info) {
        newTmpl = new Template(noopTmplSrc, this, '', eagerCompile);
      } else {
        newTmpl = new Template(info.src, this, info.path, eagerCompile);
        if (!info.noCache) {
          info.loader.cache[name] = newTmpl;
        }
      }
      cb(null, newTmpl);
    });

    return undefined;
  }

  _getTemplateAsync(name, eagerCompile, parentName, ignoreMissing) {
    var that = this;
    var tmpl = null;

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
      if (eagerCompile) {
        tmpl.compile();
      }
      return Promise.resolve(tmpl);
    }

    return new Promise((resolve, reject) => {
      lib.asyncIter(this.loaders, (loader, i, next, done) => {
        function handle(err, src) {
          if (err) {
            done(err);
          } else if (src) {
            src.loader = loader;
            done(null, src);
          } else {
            next();
          }
        }

        name = that.resolveTemplate(loader, parentName, name);

        if (loader.async) {
          loader.getSource(name, handle);
        } else {
          handle(null, loader.getSource(name));
        }
      }, (err, info) => {
        if (!info && !err && !ignoreMissing) {
          err = new Error('template not found: ' + name);
        }
        if (err) {
          reject(err);
          return;
        }
        let newTmpl;
        if (!info) {
          newTmpl = new Template(noopTmplSrc, this, '', eagerCompile);
        } else {
          newTmpl = new Template(info.src, this, info.path, eagerCompile);
          if (!info.noCache) {
            info.loader.cache[name] = newTmpl;
          }
        }
        resolve(newTmpl);
      });
    });
  }

  express(app) {
    return expressApp(this, app);
  }

  render(name, ctx, cb) {
    if (lib.isFunction(ctx)) {
      cb = ctx;
      ctx = null;
    }

    const renderPromise = new Promise((resolve, reject) => {
      this.getTemplate(name, (err, tmpl) => {
        if (err) {
          if (cb) {
            callbackAsap(cb, err);
          }
          reject(err);
        } else {
          const result = tmpl.render(ctx);
          if (result && typeof result.then === 'function') {
            result.then(resolve).catch(reject);
          } else {
            resolve(result);
          }
        }
      });
    });

    if (cb) {
      renderPromise.then((res) => cb(null, res)).catch((err) => cb(err));
    }

    return renderPromise;
  }

  renderString(src, ctx, opts, cb) {
    if (lib.isFunction(opts)) {
      cb = opts;
      opts = {};
    }
    opts = opts || {};

    const tmpl = new Template(src, this, opts.path);
    return tmpl.render(ctx, cb);
  }

  waterfall(tasks, callback, forceAsync) {
    return waterfall(tasks, callback, forceAsync);
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

class Template extends Obj {
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

  render(ctx, parentFrame, cb) {
    if (typeof ctx === 'function') {
      cb = ctx;
      ctx = {};
    } else if (typeof parentFrame === 'function') {
      cb = parentFrame;
      parentFrame = null;
    }

    try {
      this.compile();
    } catch (e) {
      const err = lib._prettifyError(this.path, this.env.opts.dev, e);
      if (cb) {
        cb(err);
        return;
      } else {
        throw err;
      }
    }

    const context = new Context(ctx || {}, this.blocks, this.env);
    const frame = parentFrame ? parentFrame.push(true) : new Frame();
    frame.topLevel = true;

    const renderPromise = (async () => {
      try {
        const result = await this.rootRenderFunc(this.env, context, frame, globalRuntime);
        return result;
      } catch (e) {
        throw lib._prettifyError(this.path, this.env.opts.dev, e);
      }
    })();

    if (cb) {
      renderPromise.then((res) => cb(null, res)).catch((err) => cb(err));
    }

    return renderPromise;
  }


  getExported(ctx, parentFrame, cb) {
    if (typeof ctx === 'function') {
      cb = ctx;
      ctx = {};
    }

    if (typeof parentFrame === 'function') {
      cb = parentFrame;
      parentFrame = null;
    }

    const exportedPromise = (async () => {
      try {
        this.compile();
      } catch (e) {
        const err = lib._prettifyError(this.path, this.env.opts.dev, e);
        throw err;
      }

      const frame = parentFrame ? parentFrame.push() : new Frame();
      frame.topLevel = true;

      const context = new Context(ctx || {}, this.blocks, this.env);
      try {
        await this.rootRenderFunc(this.env, context, frame, globalRuntime);
        return context.getExported();
      } catch (e) {
        throw lib._prettifyError(this.path, this.env.opts.dev, e);
      }
    })();

    if (cb) {
      exportedPromise.then((res) => cb(null, res)).catch((err) => cb(err));
    }

    return exportedPromise;
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

export {
  Environment,
  Template
};
