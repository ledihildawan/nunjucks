import { createErrorFormatter } from '../error/index.js';
import { createFileSystemLoader } from '../loaders/file-system.js';
import { createEmitter } from '../object/index.js';
import { createSandboxedContext, getUndefinedMode, DEFAULT_UNDEFINED_MODE, toContext } from '../runtime/index.js';
import { HOOK_EVENTS, createHookEmitter } from '../runtime/hooks.js';
import { createTemplate, isTemplate } from '../template/index.js';
import { createDelimiters, DEFAULT_BLOCK_START, DEFAULT_VARIABLE_START, DEFAULT_COMMENT_START } from '../lexer/delimiters.js';
import fs from 'fs';
import {
  resolveTemplatePath,
} from './loader-helpers.js';
import {
  findCachedTemplate,
  normalizeIncludeChain,
  resolveTemplateName,
  validateTemplateName
} from './resolver.js';
import { wrapAsyncFilter } from './filter-wrappers.js';
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

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildNunjucksPattern(tags) {
  const blockStart = tags?.BLOCK_START || DEFAULT_BLOCK_START;
  const variableStart = tags?.VARIABLE_START || DEFAULT_VARIABLE_START;
  const commentStart = tags?.COMMENT_START || DEFAULT_COMMENT_START;
  return new RegExp(`${escapeRegex(blockStart)}|${escapeRegex(variableStart)}|${escapeRegex(commentStart)}`);
}

export function createEnvironment(loaders, opts) {
  const env = createEmitter({ name: 'Environment' });

  const normalizedOpts = { ...DEFAULT_OPTS, ...opts };
  normalizedOpts.undefined = getUndefinedMode(normalizedOpts);

  if (opts?.tags) {
    normalizedOpts.tags = createDelimiters(opts.tags);
  }

  const NUNJUCKS_PATTERN = buildNunjucksPattern(normalizedOpts.tags);

  const { emitHook } = createHookEmitter(env, { envName: opts?.name });

  env.opts = normalizedOpts;
  env._renderingTemplates = new Set();
  env.loaders = normalizeLoaders(loaders, createFileSystemLoader);
  env.filters = {};
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
    return Boolean(env.extensions[name]);
  };

  env.addGlobal = function(name, value) {
    env.globals[name] = value;
    return env;
  };

  env.getGlobal = function(name) {
    if (typeof env.globals[name] === 'undefined') {
      const err = new Error(`global not found: ${name}`);
      err.code = 'GLOBAL_NOT_FOUND';
      err.subject = name;
      throw err;
    }
    return env.globals[name];
  };

  env.addFilter = function(name, func) {
    env.filters[name] = func;
    return env;
  };

  env.getFilter = function(name) {
    if (!env.filters[name]) {
      const err = new Error(`filter not found: ${name}`);
      err.code = 'UNDEFINED_FILTER';
      err.subject = name;
      throw err;
    }
    const filter = env.filters[name];
    const wrapped = wrapAsyncFilter(filter, name);
    return wrapped;
  };

  env.addTest = function(name, func) {
    env.tests[name] = func;
    return env;
  };

  env.getTest = function(name) {
    if (!env.tests[name]) {
      const err = new Error(`test not found: ${name}`);
      err.code = 'TEST_NOT_FOUND';
      err.subject = name;
      throw err;
    }
    return env.tests[name];
  };

  env.getTemplate = async function(name, eagerCompile, includeChain, ignoreMissing) {
    const startTime = Date.now();
    const { parentName, chain } = normalizeIncludeChain(includeChain);
    const resolvedName = resolveTemplateName(name);

    emitHook(HOOK_EVENTS.TEMPLATE_LOADING, { name: resolvedName, eagerCompile, parentName });

    if (isTemplate(resolvedName)) {
      const tmpl = resolvedName;
      if (chain) tmpl._includeChain = chain;
      if (eagerCompile) tmpl.compile();
      emitHook(HOOK_EVENTS.TEMPLATE_LOADED, { name: resolvedName, template: tmpl, duration: Date.now() - startTime, fromCache: true });
      return tmpl;
    }

    try {
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
        emitHook(HOOK_EVENTS.TEMPLATE_LOADED, { name: resolvedName, template: cached.tmpl, duration: Date.now() - startTime, fromCache: true });
        return cached.tmpl;
      }

      const info = await env._loadTemplate(resolvedName, parentName, ignoreMissing);
      if (!info) {
        const emptyTmpl = createTemplate(noopTmplSrc, env, '', eagerCompile);
        if (chain) emptyTmpl._includeChain = chain;
        emitHook(HOOK_EVENTS.TEMPLATE_LOADED, { name: resolvedName, template: emptyTmpl, duration: Date.now() - startTime, fromCache: false });
        return emptyTmpl;
      }

      const newTmpl = createTemplate(info.src, env, info.path, eagerCompile);
      if (chain) newTmpl._includeChain = chain;
      if (!info.loader.noCache) {
        info.loader.cache[resolvedName] = newTmpl;
      }
      emitHook(HOOK_EVENTS.TEMPLATE_LOADED, { name: resolvedName, template: newTmpl, duration: Date.now() - startTime, fromCache: false });
      return newTmpl;
    } catch (error) {
      emitHook(HOOK_EVENTS.TEMPLATE_LOAD_ERROR, { name: resolvedName, error, parentName });
      throw error;
    }
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

  env.render = async function(source, ctx, renderOpts) {
    const renderContext = toContext(ctx);
    const startTime = Date.now();

    if (NUNJUCKS_PATTERN.test(source) || renderOpts?.path) {
      return await renderStringInternal(source, renderContext, renderOpts, startTime);
    }

    let tmpl;
    try {
      tmpl = await env.getTemplate(source);
    } catch (e) {
      const err = await env.getErrorFormatter().formatError(e, source, {
        templatePath: source,
        renderContext: renderContext.toObject(),
      });
      console.error(err.toConsoleString());
      throw err;
    }

    const sandboxedCtx = createSandboxedContext(renderContext.toObject(), env.opts.sandbox);
    sandboxedCtx.__nunjucks_undefined_mode = env.opts.undefined;

    emitHook(HOOK_EVENTS.RENDER_START, { template: source, context: renderContext.toObject(), templatePath: tmpl.path });

    try {
      const result = await tmpl.render(sandboxedCtx);
      emitHook(HOOK_EVENTS.RENDER_COMPLETE, { template: source, output: result, duration: Date.now() - startTime, templatePath: tmpl.path });
      return result;
    } catch (e) {
      const templatePath = tmpl.path || source;
      const err = await env.getErrorFormatter().formatError(e, source, {
        templatePath,
        renderContext: renderContext.toObject(),
      });
      console.error(err.toConsoleString());
      emitHook(HOOK_EVENTS.RENDER_ERROR, { template: source, error: e, context: renderContext.toObject(), templatePath });
      throw err;
    }
  };

  async function renderStringInternal(src, ctx, strOpts, startTime = Date.now()) {
    const renderContext = toContext(ctx);
    const callerLocation = !strOpts?.path || strOpts.path === '<anonymous>' 
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
    if (strOpts?.path && strOpts.path !== '<anonymous>') {
      path = strOpts.path;
    } else if (callerLocation) {
      path = `${callerLocation.fullPath}:${callerLocation.line}`;
    } else {
      path = '<anonymous>';
    }
    
    const tmpl = createTemplate(src, env, path);
    const sandboxedCtx = createSandboxedContext(renderContext.toObject(), env.opts.sandbox);
    sandboxedCtx.__nunjucks_undefined_mode = env.opts.undefined;

    emitHook(HOOK_EVENTS.RENDER_START, { template: 'renderString', context: renderContext.toObject(), templatePath: path });

    try {
      const result = await tmpl.render(sandboxedCtx);
      emitHook(HOOK_EVENTS.RENDER_COMPLETE, { template: 'renderString', output: result, duration: Date.now() - startTime, templatePath: path });
      return result;
    } catch (e) {
      const err = await env.getErrorFormatter().formatError(path, {
        renderContext: renderContext.toObject(),
        sourceContent: src,
        jsCaller: callerLocation,
        jsCallerSource: jsCallerSource,
        jsCallerErrorLine: callerLocation?.line,
      });
      console.error(err.toConsoleString());
      emitHook(HOOK_EVENTS.RENDER_ERROR, { template: 'renderString', error: e, context: renderContext.toObject(), templatePath: path });
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
}

export function createSandboxedEnvironment(loaders, opts) {
  return createEnvironment(loaders, { ...opts, sandbox: true });
}

export { createTemplate };
