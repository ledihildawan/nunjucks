import { createCompiler } from '../compiler/index.js';
import { parse } from '../parser/index.js';
import { transform } from '../transformers/index.js';
import { execute } from './compiler.js';
import { validateTemplate, validateRenderContext, validateConfig } from './validator.js';
import { withTimeout } from '../runtime/timeout.js';
import { createSandboxedContext } from '../runtime/sandbox.js';
import { createLog, toHtml, toAnsi, toText, injectWarningsScript } from '@nunjucks/log';
import { createFileSystemLoader } from '../loaders/index.js';
import { getCallerFile } from '@nunjucks/shared/caller-file';

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

const wrapWithError = (err, config, template = null, renderContext = null) => {
  const templatePath = config.templatePath || config.jsCaller || config._callerFile || err.templateName || null;
  const errLineno = err.lineno;
  const errColno = err.colno;
  const useJsCaller = errLineno == null && config.jsCallerErrorLine;
  const lineno = useJsCaller ? config.jsCallerErrorLine : (errLineno ?? config.lineno ?? 1);
  const colno = useJsCaller ? config.jsCallerErrorCol : (errColno ?? config.colno ?? 1);
  const phase = err.phase || config.phase || 'render';
  const dev = config.dev ?? false;
  const ide = config.ide ?? 'vscode';
  const timestamp = new Date().toISOString();

  const errorObj = createLog('error', {
    message: err.message,
    lineno,
    colno,
    info: {
      code: err.code,
      subject: err.subject,
      phase,
      templateName: templatePath
    }
  });

  errorObj.output = (options = {}) => {
    const { format = 'html', verbosity = 'full' } = options;
    const formatConfig = { dev, ide, templatePath, lineno, colno, phase, sourceContent: template, renderContext, timestamp, verbosity, isJsCaller: useJsCaller };

    switch (format) {
      case 'html':
        return toHtml(errorObj, formatConfig);
      case 'ansi':
        return toAnsi(errorObj, formatConfig);
      case 'text':
        return toText(errorObj, formatConfig);
      default:
        return {
          html: toHtml(errorObj, formatConfig),
          ansi: toAnsi(errorObj, formatConfig),
          text: toText(errorObj, formatConfig)
        };
    }
  };

  return errorObj;
};

export const render = async (template, context = {}, config = {}) => {
  config._callerFile = config._callerFile || getCallerFile();

  if (typeof template !== 'string') {
    const err = new Error('Template must be a string');
    err.code = 'TEMPLATE_MUST_BE_STRING';
    throw wrapWithError(err, config, template, context);
  }

  const validation = validateConfig(config);
  if (!validation.valid) {
    const err = new Error(validation.errors[0].message);
    throw wrapWithError(err, config, template, context);
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
    throw wrapWithError(err, config, templateSource, context);
  }

  const contextValidation = validateRenderContext(context, config);
  if (!contextValidation.valid) {
    const err = new Error(contextValidation.errors[0].message);
    throw wrapWithError(err, config, templateSource, context);
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
    throw wrapWithError(err, config, templateSource, context);
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

  const runtime = buildRuntime(config);
  const warningsCollector = [];

  let result;
  try {
    const renderPromise = execute(code, sandboxedCtx, {
      ...config,
      runtime,
      warningsCollector,
      templateName,
      sourceMapData
    });

    if (config.executionTimeout > 0) {
      result = await withTimeout(renderPromise, config.executionTimeout);
    } else {
      result = await renderPromise;
    }
  } catch (err) {
    throw wrapWithError(err, config, templateSource, context);
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
    throw wrapWithError(err, { ...config, templatePath: config.templatePath || templateName, env }, null, context);
  }

  const contextValidation = validateRenderContext(context, config);
  if (!contextValidation.valid) {
    const err = new Error(contextValidation.errors[0].message);
    throw wrapWithError(err, { ...config, templatePath: config.templatePath || templateName, env }, null, context);
  }

  let template;
  try {
    template = await env.getTemplate(templateName, true, templateName, false);
    
    if (typeof template.render === 'function') {
      const result = await template.render(context);
      return result;
    }
    
    throw new Error('Template object is invalid: missing render method');
  } catch (err) {
    throw wrapWithError(err, { ...config, templatePath: config.templatePath || templateName, env }, template?.tmplStr ?? null, context);
  }
};
