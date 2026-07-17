import EventEmitter from 'events';
import { createCompiler } from '../compiler/index.js';
import { parse } from '../parser/index.js';
import { transform } from '../transformers/index.js';
import { execute } from './compiler.js';
import { validateTemplate, validateRenderContext, validateConfig } from './validator.js';
import { withTimeout } from '../runtime/timeout.js';
import { createSandboxedContext } from '../runtime/sandbox.js';
import { createLog, injectWarningsScript } from '@nunjucks/log';
import { createFileSystemLoader } from '../loaders/index.js';
import { getCallerFile } from '@nunjucks/shared/caller-file';
import { ERROR_DEFINITIONS } from '@nunjucks/log/error/messages';

let cachedLoader = null;
let cachedViewsPath = null;

const getLoader = (config) => {
  const viewsPath = config.views || config.root;
  if (!viewsPath) return null;

  if (cachedLoader && cachedViewsPath === viewsPath) {
    return cachedLoader;
  }

  cachedLoader = createFileSystemLoader(viewsPath, { noCache: config.dev || false });
  cachedViewsPath = viewsPath;
  return cachedLoader;
};

const extractCodeContext = (filePath, errorLine, errorCol, templateHint = null) => {
  try {
    const fs = require('fs');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    let resolvedLine = errorLine;
    let resolvedCol = errorCol;

    if (templateHint && typeof templateHint === 'string') {
      const searchStart = Math.max(1, (errorLine ?? 1) - 2);
      const searchEnd = Math.min(lines.length, (errorLine ?? 1) + 2);
      const snippetHint = templateHint.length > 80 ? templateHint.slice(0, 80) : templateHint;

      for (let lineNumber = searchStart; lineNumber <= searchEnd; lineNumber++) {
        const line = lines[lineNumber - 1] || '';
        const hintIndex = line.indexOf(snippetHint);
        if (hintIndex !== -1) {
          resolvedLine = lineNumber;
          resolvedCol = hintIndex + 1;
          break;
        }
      }
    }

    if (resolvedLine < 1 || resolvedLine > lines.length) {
      return { content, startLine: 1 };
    }

    const windowSize = 10;
    let startLine = Math.max(1, resolvedLine - windowSize);
    let endLine = Math.min(lines.length, resolvedLine + windowSize);

    return {
      content: lines.slice(startLine - 1, endLine).join('\n'),
      startLine,
      errorCol: resolvedCol,
      errorLine: resolvedLine
    };
  } catch {
    return null;
  }
};

const wrapWithLog = (err, config, template = null, renderContext = null) => {
  const templatePath = config.templatePath || config.jsCaller || config._callerFile || err.templateName || null;
  const errLineno = err.lineno;
  const errColno = err.colno;
  const useJsCaller = config.jsCallerErrorLine != null;
  const hasErrorLocation = errLineno !== undefined && errLineno !== null;
  const isInlineTemplate = typeof template === 'string' &&
    (template.includes('{{') || template.includes('{%') || template.includes('{#'));
  const preferJsCallerLocation = useJsCaller && !config.templatePath && isInlineTemplate;
  const phase = err.phase || config.phase || 'render';
  const dev = config.dev ?? false;
  const ide = config.ide ?? 'vscode';
  const timestamp = new Date().toISOString();

  let sourceContent = template;
  let sourceStartLine = 1;
  let resolvedJsCallerLine = config.jsCallerErrorLine ?? null;
  let resolvedJsCallerCol = config.jsCallerErrorCol ?? null;

  if (useJsCaller && config.jsCaller) {
    const codeContext = extractCodeContext(
      config.jsCaller,
      config.jsCallerErrorLine,
      config.jsCallerErrorCol,
      preferJsCallerLocation ? template : null
    );
    if (codeContext) {
      sourceContent = codeContext.content;
      sourceStartLine = codeContext.startLine;
      resolvedJsCallerLine = codeContext.errorLine ?? resolvedJsCallerLine;
      resolvedJsCallerCol = codeContext.errorCol ?? resolvedJsCallerCol;
    }
  }

  const lineno = preferJsCallerLocation
    ? (resolvedJsCallerLine ?? errLineno ?? config.lineno ?? null)
    : (hasErrorLocation ? errLineno : (resolvedJsCallerLine ?? config.lineno ?? null));
  const colno = preferJsCallerLocation
    ? (resolvedJsCallerCol ?? errColno ?? config.colno ?? null)
    : (hasErrorLocation ? (errColno ?? null) : (resolvedJsCallerCol ?? config.colno ?? null));

  const errorDef = {
    name: err.code || 'RENDER_ERROR',
    message: () => err.message,
    pattern: /./,
  };
  const errorObj = createLog('error', errorDef, {}, err.subject, {
    lineno,
    colno,
    phase,
    templateName: templatePath,
    lineBase: preferJsCallerLocation ? 'one' : (err.lineBase ?? (!hasErrorLocation && useJsCaller ? 'one' : 'zero')),
    dev,
    ide,
    templatePath,
    sourceContent,
    sourceStartLine,
    renderContext,
    timestamp,
    verbosity: 'full',
    isJsCaller: useJsCaller,
  });

  return errorObj;
};

export const render = async (template, context = {}, config = {}) => {
  config._callerFile = config._callerFile || getCallerFile();

  if (typeof template !== 'string') {
    const err = createLog('error', ERROR_DEFINITIONS.TEMPLATE_MUST_BE_STRING, {}, null, { phase: 'render' });
    throw wrapWithLog(err, config, template, context);
  }

  const validation = validateConfig(config);
  if (!validation.valid) {
    const err = new Error(validation.errors[0].message);
    throw wrapWithLog(err, config, template, context);
  }

  const loader = getLoader(config);
  let templateSource = template;
  
  if (loader && !template.includes('{{') && !template.includes('{%') && !template.includes('{#')) {
    try {
      const source = await loader.getSource(template);
      if (source && source.src) {
        templateSource = source.src;
        if (!config.templatePath) {
          config.templatePath = source.path;
        }
      }
    } catch (loaderErr) {
      // Fall back to treating template as inline template string
    }
  }

  const templateValidation = validateTemplate(template, config);
  if (!templateValidation.valid) {
    const err = new Error(templateValidation.errors[0].message);
    throw wrapWithLog(err, config, templateSource, context);
  }

  const contextValidation = validateRenderContext(context, config);
  if (!contextValidation.valid) {
    const err = new Error(contextValidation.errors[0].message);
    throw wrapWithLog(err, config, templateSource, context);
  }

  let code;
  let sourceMapData;
  const looksLikeFile = /\.(njk|js|html|htm|twig|ejs|eta)$/i.test(template);
  const templateName = config.templatePath || (looksLikeFile ? template : config._callerFile);
  try {
    const c = createCompiler(templateName, config.undefined, templateSource);
    const ast = parse(templateSource, config, templateName);
    const transformedAst = transform(ast, [], templateName);
    c.compile(transformedAst);
    code = c.getCode();
    sourceMapData = c.getSourceMap().mappings;
  } catch (err) {
    throw wrapWithLog(err, config, templateSource, context);
  }

  const internalKeys = ['__nunjucks_undefined_mode', 'exports', 'module', 'require', '__dirname', '__filename', 'global', 'globalThis', 'process'];
  const userAllowlist = config.sandboxAllowlist || [];
  const mergedAllowlist = [...new Set([...internalKeys, ...userAllowlist])];
  
  const sandboxOptions = {
    allowlist: mergedAllowlist,
    blocklistMode: config.sandboxMode !== 'allowlist'
  };
  const sandboxedCtx = createSandboxedContext(context, config.sandbox, sandboxOptions);
  sandboxedCtx.__nunjucks_undefined_mode = config.undefined || 'default';

  if (loader && !config.env) {
    const emitter = new EventEmitter();
    config.env = {
      opts: {
        dev: config.dev ?? false,
        autoescape: config.autoescape ?? true,
        undefined: config.undefined ?? 'default'
      },
      extensionsList: [],
      globals: config.globals || {},
      _renderingTemplates: new Set(),
      on: (event, handler) => emitter.on(event, handler),
      emit: (event, ...args) => emitter.emit(event, ...args),
      removeListener: (event, handler) => emitter.removeListener(event, handler),
      async getTemplate(name, eagerCompile, includeChain, ignoreMissing) {
        const source = await loader.getSource(name);
        if (!source) {
          if (ignoreMissing) return null;
          throw createLog('error', ERROR_DEFINITIONS.FILE_NOT_FOUND, { path: name }, name, { phase: 'load' });
        }
        const { createTemplate } = await import('../template/index.js');
        return createTemplate(source.src, this, source.path, eagerCompile);
      }
    };
  }

  const runtime = buildRuntime(config);
  const warningsCollector = [];

  let result;
  try {
    const renderPromise = execute(code, sandboxedCtx, {
      ...config,
      runtime,
      warningsCollector,
      templateName,
      sourceMapData,
      renderContext: context
    });

    if (config.executionTimeout > 0) {
      result = await withTimeout(renderPromise, config.executionTimeout);
    } else {
      result = await renderPromise;
    }
  } catch (err) {
    throw wrapWithLog(err, config, templateSource, context);
  }

  if (warningsCollector.length > 0 && (config.dev ?? false)) {
    result = result + injectWarningsScript(warningsCollector, { dev: true, verbosity: 'medium' });
  }

  return result;
};

const buildRuntime = (config) => {
  const filters = config.filters || {};
  const globals = config.globals || {};

  return {
    ...globals,
    ...Object.fromEntries(
      Object.entries(filters).map(([name, fn]) => [
        name,
        function(...args) {
          return fn(...args);
        }
      ])
    )
  };
};

export const renderWithEnv = async (templateName, env, context = {}, config = {}) => {
  const validation = validateConfig(config);
  if (!validation.valid) {
    const err = new Error(validation.errors[0].message);
    throw wrapWithLog(err, { ...config, templatePath: config.templatePath || templateName, env }, null, context);
  }

  const contextValidation = validateRenderContext(context, config);
  if (!contextValidation.valid) {
    const err = new Error(contextValidation.errors[0].message);
    throw wrapWithLog(err, { ...config, templatePath: config.templatePath || templateName, env }, null, context);
  }

  let template;
  try {
    template = await env.getTemplate(templateName, true, templateName, false);
    
    if (typeof template.render === 'function') {
      const result = await template.render(context);
      return result;
    }
    
    throw createLog('error', ERROR_DEFINITIONS.TEMPLATE_NO_RENDER, {}, null, { phase: 'render' });
  } catch (err) {
    throw wrapWithLog(err, { ...config, templatePath: config.templatePath || templateName, env }, template?.tmplStr ?? null, context);
  }
};
