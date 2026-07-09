import { isArray, isString, entries, pipe } from 'remeda';
import { prettifyError, createErrorFormatter } from './error/index.js';
import { compile } from './compiler.js';
import * as filters from './filters.js';
import { FileSystemLoader } from './loaders/node/index.js';
import { WebLoader } from './loaders/web/index.js';
import { PrecompiledLoader } from './loaders/precompiled-loader.js';
import * as tests from './tests.js';
import globals from './globals.js';
import { EmitterObj } from './object.js';
import { Frame } from './runtime/index.js';
import expressApp from './express-app.js';
import { Template } from './template.js';

export { Template };

const VERSION = '3.2.4';

const DEFAULT_OPTS = {
  dev: false,
  version: VERSION,
  autoescape: true,
  throwOnUndefined: false,
  trimBlocks: false,
  lstripBlocks: false,
  ide: 'vscode'
};

const noopTmplSrc = {
  type: 'code',
  obj: { async root() { return ''; } }
};

const isRelativePath = (loader, filename) =>
  (loader.isRelative && filename) ? loader.isRelative(filename) : false;

const resolveTemplatePath = (loader, parentName, filename) =>
  isRelativePath(loader, filename) && loader.resolve
    ? loader.resolve(parentName, filename)
    : filename;

const findCachedTemplate = (loaders, resolveFn, name, parentName) => {
  for (const loader of loaders) {
    const resolved = resolveFn(loader, parentName, name);
    const cached = loader.cache[resolved];
    if (cached) return { tmpl: cached, loader };
  }
  return null;
};

const normalizeIncludeChain = (includeChain) => {
  if (!includeChain) return { parentName: null, chain: null };
  if (typeof includeChain === 'string') return { parentName: includeChain, chain: null };
  if (typeof includeChain === 'object') return { parentName: includeChain.parentTmpl, chain: includeChain };
  return { parentName: null, chain: null };
};

const resolveTemplateName = (name) => name?.raw || name;

const validateTemplateName = (name) => {
  if (name instanceof Template) return null;
  if (typeof name === 'string') return null;
  const err = new Error('template names must be a string: ' + name);
  err.code = 'INVALID_INCLUDE';
  throw err;
};

const wrapFilterWithError = (filter, name) => {
  const tag = (err) => {
    err.code = err.code || 'FILTER_ERROR';
    err.subject = err.subject || name;
    return err;
  };

  return function(...args) {
    if (!args.some(a => a && typeof a.then === 'function')) {
      try {
        return filter.apply(this, args);
      } catch (err) {
        throw tag(err);
      }
    }
    return Promise.all(args).then(resolved => {
      try {
        return filter.apply(this, resolved);
      } catch (err) {
        throw tag(err);
      }
    });
  };
};

const wrapAsyncFilter = (filter, name) => {
  const tag = (err) => {
    err.code = err.code || 'FILTER_ERROR';
    err.subject = err.subject || name;
    return err;
  };

  return async function(...args) {
    const resolvedArgs = await Promise.all(args.map(async arg => {
      if (arg && typeof arg.then === 'function') return arg.then(v => v);
      return arg;
    }));
    try {
      return await filter.apply(this, resolvedArgs);
    } catch (err) {
      throw tag(err);
    }
  };
};

export class Environment extends EmitterObj {
  init(loaders, opts) {
    this.opts = { ...DEFAULT_OPTS, ...opts };
    this._renderingTemplates = new Set();
    this.loaders = this._normalizeLoaders(loaders);
    this._initLoaders();
    this._registerBuiltIns();
  }

  _normalizeLoaders(loaders) {
    if (!loaders) {
      if (FileSystemLoader) return [new FileSystemLoader('views')];
      if (WebLoader) return [new WebLoader('/views')];
      return [];
    }
    return isArray(loaders) ? loaders : [loaders];
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

    if (typeof window !== 'undefined' && window.nunjucksPrecompiled) {
      this.loaders.unshift(new PrecompiledLoader(window.nunjucksPrecompiled));
    }
  }

  _registerBuiltIns() {
    this.globals = globals();
    this.filters = {};
    this.tests = {};
    this.asyncFilters = [];
    this.extensions = {};
    this.extensionsList = [];

    entries(filters).forEach(([name, filter]) => this.addFilter(name, filter));
    entries(tests).forEach(([name, test]) => this.addTest(name, test));
  }

  invalidateCache() {
    this.loaders.forEach(loader => { loader.cache = {}; });
  }

  addExtension(name, extension) {
    extension.__name = name;
    this.extensions[name] = extension;
    this.extensionsList.push(extension);
    return this;
  }

  removeExtension(name) {
    const extension = this.getExtension(name);
    if (!extension) return;
    this.extensionsList = this.extensionsList.filter(ext => ext !== extension);
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
      const err = new Error('global not found: ' + name);
      err.code = 'GLOBAL_NOT_FOUND';
      err.subject = name;
      throw err;
    }
    return this.globals[name];
  }

  addFilter(name, func, async) {
    if (async) this.asyncFilters.push(name);
    this.filters[name] = func;
    return this;
  }

  getFilter(name) {
    if (!this.filters[name]) {
      const err = new Error('filter not found: ' + name);
      err.code = 'UNDEFINED_FILTER';
      err.subject = name;
      throw err;
    }
    const filter = this.filters[name];
    const wrapped = this.asyncFilters.includes(name)
      ? wrapAsyncFilter(filter, name)
      : wrapFilterWithError(filter, name);
    return wrapped;
  }

  addTest(name, func) {
    this.tests[name] = func;
    return this;
  }

  getTest(name) {
    if (!this.tests[name]) {
      const err = new Error('test not found: ' + name);
      err.code = 'TEST_NOT_FOUND';
      err.subject = name;
      throw err;
    }
    return this.tests[name];
  }

  async getTemplate(name, eagerCompile, includeChain, ignoreMissing) {
    const { parentName, chain } = normalizeIncludeChain(includeChain);
    const resolvedName = resolveTemplateName(name);

    if (resolvedName instanceof Template) {
      const tmpl = resolvedName;
      if (chain) tmpl._includeChain = chain;
      if (eagerCompile) tmpl.compile();
      return tmpl;
    }

    validateTemplateName(resolvedName);

    const cached = findCachedTemplate(
      this.loaders,
      (loader, pName, n) => this.resolveTemplate(loader, pName, n),
      resolvedName,
      parentName
    );

    if (cached) {
      if (!chain) cached.tmpl._includeChain = null;
      else cached.tmpl._includeChain = chain;
      if (eagerCompile) cached.tmpl.compile();
      return cached.tmpl;
    }

    const info = await this._loadTemplate(resolvedName, parentName, ignoreMissing);
    if (!info) {
      const emptyTmpl = new Template(noopTmplSrc, this, '', eagerCompile);
      if (chain) emptyTmpl._includeChain = chain;
      return emptyTmpl;
    }

    const newTmpl = new Template(info.src, this, info.path, eagerCompile);
    if (chain) newTmpl._includeChain = chain;
    if (!info.loader.noCache) {
      info.loader.cache[resolvedName] = newTmpl;
    }
    return newTmpl;
  }

  async _loadTemplate(name, parentName, ignoreMissing) {
    for (const loader of this.loaders) {
      const resolvedName = this.resolveTemplate(loader, parentName, name);
      const src = loader.async ? await loader.getSource(resolvedName) : loader.getSource(resolvedName);

      if (src) {
        src.loader = loader;
        return src;
      }
    }

    if (!ignoreMissing) {
      const err = new Error('template not found: ' + name);
      err.code = 'FILE_NOT_FOUND';
      err.subject = name;
      throw err;
    }
    return null;
  }

  resolveTemplate(loader, parentName, filename) {
    return resolveTemplatePath(loader, parentName, filename);
  }

  express(app) {
    return expressApp(this, app);
  }

  getErrorFormatter() {
    if (!this._errorFormatter) {
      this._errorFormatter = createErrorFormatter({
        ide: this.opts.ide,
        version: this.opts.version,
        dev: this.opts.dev
      });
    }
    return this._errorFormatter;
  }

  async formatError(error, templateName, options = {}) {
    return this.getErrorFormatter().formatError(error, templateName, options);
  }

  async render(name, ctx) {
    const tmpl = await this.getTemplate(name);
    return tmpl.render(ctx);
  }

  async renderString(src, ctx, opts) {
    const tmpl = new Template(src, this, opts?.path);
    return tmpl.render(ctx);
  }
}
