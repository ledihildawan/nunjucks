import { prettifyError, createErrorFormatter } from '../error/index.js';
import { compile } from '../compiler/index.js';
import { FileSystemLoader } from '../loaders/file-system.js';
import { WebLoader } from '../loaders/web.js';
import { PrecompiledLoader } from '../loaders/precompiled.js';
import { EmitterObj } from '../object/index.js';
import { Frame } from '../runtime/index.js';
import expressApp from '../integration/express-app.js';
import { Template } from '../template/index.js';
import {
  isRelativePath,
  resolveTemplatePath,
} from './template-loader-helpers.js';
import {
  findCachedTemplate,
  normalizeIncludeChain,
  resolveTemplateName,
  validateTemplateName
} from './template-resolver.js';
import { wrapFilterWithError, wrapAsyncFilter } from './filter-wrappers.js';
import { normalizeLoaders, registerBuiltIns } from './built-ins.js';

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

export class Environment extends EmitterObj {
  init(loaders, opts) {
    this.opts = { ...DEFAULT_OPTS, ...opts };
    this._renderingTemplates = new Set();
    this.loaders = normalizeLoaders(loaders, FileSystemLoader, WebLoader);
    this._initLoaders();
    registerBuiltIns(this);
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
