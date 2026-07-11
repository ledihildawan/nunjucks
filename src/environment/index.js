import { prettifyError, createErrorFormatter } from '../error/index.js';
import { compile } from '../compiler/index.js';
import { createFileSystemLoader } from '../loaders/file-system.js';
import { createWebLoader } from '../loaders/web.js';
import { createPrecompiledLoader } from '../loaders/precompiled.js';
import { createEmitter } from '../object/index.js';
import { createFrame, createSandboxedContext, getUndefinedMode, DEFAULT_UNDEFINED_MODE } from '../runtime/index.js';
import expressApp from '../integration/express-app.js';
import { createTemplate } from '../template/index.js';
import fs from 'fs';
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
import { getCallerLocation } from '../shared/caller-location.js';

const VERSION = '3.2.4';

const DEFAULT_OPTS = {
  dev: false,
  version: VERSION,
  autoescape: true,
  undefined: DEFAULT_UNDEFINED_MODE,
  trimBlocks: false,
  lstripBlocks: false,
  ide: 'vscode',
  sandbox: false
};

const noopTmplSrc = {
  type: 'code',
  obj: { async root() { return ''; } }
};

export function createEnvironment(loaders, opts) {
  const env = createEmitter('Environment');

  const normalizedOpts = { ...DEFAULT_OPTS, ...opts };
  normalizedOpts.undefined = getUndefinedMode(normalizedOpts);

  env.opts = normalizedOpts;
  env._renderingTemplates = new Set();
  env.loaders = normalizeLoaders(loaders, createFileSystemLoader, createWebLoader);
  env.filters = {};
  env.asyncFilters = [];
  env.globals = {};
  env.extensions = {};
  env.extensionsList = [];
  env.tests = {};

  initLoaders(env);

  env.invalidateCache = function() {
    env.loaders.forEach(loader => { loader.cache = {}; });
  };

  env.addExtension = function(name, extension) {
    extension.__name = name;
    env.extensions[name] = extension;
    env.extensionsList.push(extension);
    return env;
  };

  env.removeExtension = function(name) {
    const extension = env.getExtension(name);
    if (!extension) return;
    env.extensionsList = env.extensionsList.filter(ext => ext !== extension);
    delete env.extensions[name];
  };

  env.getExtension = function(name) {
    return env.extensions[name];
  };

  env.hasExtension = function(name) {
    return !!env.extensions[name];
  };

  env.addGlobal = function(name, value) {
    env.globals[name] = value;
    return env;
  };

  env.getGlobal = function(name) {
    if (typeof env.globals[name] === 'undefined') {
      const err = new Error('global not found: ' + name);
      err.code = 'GLOBAL_NOT_FOUND';
      err.subject = name;
      throw err;
    }
    return env.globals[name];
  };

  env.addFilter = function(name, func, async) {
    if (async) env.asyncFilters.push(name);
    env.filters[name] = func;
    return env;
  };

  env.getFilter = function(name) {
    if (!env.filters[name]) {
      const err = new Error('filter not found: ' + name);
      err.code = 'UNDEFINED_FILTER';
      err.subject = name;
      throw err;
    }
    const filter = env.filters[name];
    const wrapped = env.asyncFilters.includes(name)
      ? wrapAsyncFilter(filter, name)
      : wrapFilterWithError(filter, name);
    return wrapped;
  };

  env.addTest = function(name, func) {
    env.tests[name] = func;
    return env;
  };

  env.getTest = function(name) {
    if (!env.tests[name]) {
      const err = new Error('test not found: ' + name);
      err.code = 'TEST_NOT_FOUND';
      err.subject = name;
      throw err;
    }
    return env.tests[name];
  };

  env.getTemplate = async function(name, eagerCompile, includeChain, ignoreMissing) {
    const { parentName, chain } = normalizeIncludeChain(includeChain);
    const resolvedName = resolveTemplateName(name);

    if (resolvedName?.typename === 'Template') {
      const tmpl = resolvedName;
      if (chain) tmpl._includeChain = chain;
      if (eagerCompile) tmpl.compile();
      return tmpl;
    }

    validateTemplateName(resolvedName);

    const cached = findCachedTemplate(
      env.loaders,
      (loader, pName, n) => env.resolveTemplate(loader, pName, n),
      resolvedName,
      parentName
    );

    if (cached) {
      if (!chain) cached.tmpl._includeChain = null;
      else cached.tmpl._includeChain = chain;
      if (eagerCompile) cached.tmpl.compile();
      return cached.tmpl;
    }

    const info = await env._loadTemplate(resolvedName, parentName, ignoreMissing);
    if (!info) {
      const emptyTmpl = createTemplate(noopTmplSrc, env, '', eagerCompile);
      if (chain) emptyTmpl._includeChain = chain;
      return emptyTmpl;
    }

    const newTmpl = createTemplate(info.src, env, info.path, eagerCompile);
    if (chain) newTmpl._includeChain = chain;
    if (!info.loader.noCache) {
      info.loader.cache[resolvedName] = newTmpl;
    }
    return newTmpl;
  };

  env._loadTemplate = async function(name, parentName, ignoreMissing) {
    for (const loader of env.loaders) {
      const resolvedName = env.resolveTemplate(loader, parentName, name);
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
  };

  env.resolveTemplate = function(loader, parentName, filename) {
    return resolveTemplatePath(loader, parentName, filename);
  };

  env.express = function(app) {
    return expressApp(env, app);
  };

  env.getErrorFormatter = function() {
    if (!env._errorFormatter) {
      env._errorFormatter = createErrorFormatter({
        ide: env.opts.ide,
        version: env.opts.version,
        dev: env.opts.dev
      });
    }
    return env._errorFormatter;
  };

  env.formatError = async function(error, templateName, options = {}) {
    return env.getErrorFormatter().formatError(error, templateName, options);
  };

  env.render = async function(name, ctx) {
    let tmpl;
    try {
      tmpl = await env.getTemplate(name);
    } catch (e) {
      const err = await env.getErrorFormatter().formatError(e, name, {
        templatePath: name,
        renderContext: ctx,
      });
      console.error(err.toConsoleString());
      throw err;
    }

    const sandboxedCtx = createSandboxedContext(ctx, env.opts.sandbox);
    sandboxedCtx.__nunjucks_undefined_mode = env.opts.undefined;

    try {
      return await tmpl.render(sandboxedCtx);
    } catch (e) {
      const templatePath = tmpl.path || name;
      const err = await env.getErrorFormatter().formatError(e, name, {
        templatePath,
        renderContext: ctx,
      });
      console.error(err.toConsoleString());
      throw err;
    }
  };

  env.renderString = async function(src, ctx, opts) {
    const callerLocation = !opts?.path || opts.path === '<anonymous>' 
      ? getCallerLocation() 
      : null;
    
    let jsCallerSource = null;
    if (callerLocation?.fullPath) {
      try {
        const content = fs.readFileSync(callerLocation.fullPath, 'utf-8').replace(/\r\n/g, '\n');
        const lines = content.split('\n');
        const startLine = Math.max(0, callerLocation.line - 3);
        const endLine = Math.min(lines.length, callerLocation.line + 2);
        const relevantLines = lines.slice(startLine, endLine);
        jsCallerSource = relevantLines
          .map((line, idx) => `${startLine + idx + 1}: ${line}`)
          .join('\n');
      } catch (e) {
        // Ignore file read errors
      }
    }
    
    let path;
    if (opts?.path && opts.path !== '<anonymous>') {
      path = opts.path;
    } else if (callerLocation) {
      path = `${callerLocation.fullPath}:${callerLocation.line}`;
    } else {
      path = '<anonymous>';
    }
    
    const tmpl = createTemplate(src, env, path);
    const sandboxedCtx = createSandboxedContext(ctx, env.opts.sandbox);
    sandboxedCtx.__nunjucks_undefined_mode = env.opts.undefined;

    try {
      return await tmpl.render(sandboxedCtx);
    } catch (e) {
      const err = await env.getErrorFormatter().formatError(e, path, {
        renderContext: ctx,
        sourceContent: src,
        jsCaller: callerLocation,
        jsCallerSource: jsCallerSource,
        jsCallerErrorLine: callerLocation?.line,
      });
      console.error(err.toConsoleString());
      throw err;
    }
  };

  registerBuiltIns(env);

  return env;
}

function initLoaders(env) {
  env.loaders.forEach((loader) => {
    loader.cache = {};
    if (typeof loader.on === 'function') {
      loader.on('update', (name, fullname) => {
        loader.cache[name] = null;
        env.emit('update', name, fullname, loader);
      });
      loader.on('load', (name, source) => {
        env.emit('load', name, source, loader);
      });
    }
  });

  if (typeof window !== 'undefined' && window.nunjucksPrecompiled) {
    env.loaders.unshift(createPrecompiledLoader(window.nunjucksPrecompiled));
  }
}

export function createSandboxedEnvironment(loaders, opts) {
  return createEnvironment(loaders, { ...opts, sandbox: true });
}

export { createTemplate };
