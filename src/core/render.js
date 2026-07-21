import EventEmitter from 'events';
import { createCompiler } from '@nunjucks/compiler';
import { parse } from '@nunjucks/parser';
import { transform } from '@nunjucks/transformers';
import { execute } from './executor.js';
import { validateTemplate, validateConfig, validateRenderContext, findContextDangerousValues } from './validators/index.js';
import { withTimeout } from '@nunjucks/runtime/timeout';
import { createSandboxedContext } from '@nunjucks/runtime/sandbox';
import { scrubDangerousReferences } from '@nunjucks/runtime/security';
import { getCallerFile, getCallerLocation } from '@nunjucks/shared/caller-file';
import { createLog, injectWarningsScript, ERROR_DEFINITIONS } from '@nunjucks/log';
import { findContextKeyPosition, wrapWithLog } from './diagnostics.js';
import { getLoader } from './engine.js';
import { createEnv } from './env.js';

const resolveTemplateSource = async (template, loader, config) => {
  let templateSource = template;
  let templatePath;

  if (loader && !template.includes('{{') && !template.includes('{%') && !template.includes('{#')) {
    try {
      const source = await loader.getSource(template);
      if (source && source.src) {
        templateSource = source.src;
        if (!config.templatePath) {
          templatePath = source.path;
        }
      }
    } catch (loaderErr) {
      const code = loaderErr && loaderErr.code;
      if (code === 'ENOENT' || code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') {
        // Fall back to treating template as inline template string
      } else {
        throw loaderErr;
      }
    }
  }

  return { templateSource, templatePath };
};

const buildValidationError = (validationError, stamps, config, templateSource, context) => {
  const err = new Error(validationError.message);
  for (const [key, value] of Object.entries(stamps)) {
    err[key] = value;
  }
  throw wrapWithLog(err, config, templateSource, context);
};

const prepareSandbox = (config, context) => {
  const internalKeys = ['__nunjucks_undefined_mode', 'exports', 'module', 'require', '__dirname', '__filename', 'global', 'globalThis', 'process'];
  const userAllowlist = config.sandboxAllowlist || [];
  const mergedAllowlist = [...new Set([...internalKeys, ...userAllowlist])];

  const sandboxOptions = {
    allowlist: mergedAllowlist,
    blocklistMode: config.sandboxMode !== 'allowlist',
    environment: config.sandboxEnvironment || 'auto'
  };
  const sandboxedCtx = createSandboxedContext(context, config.sandbox, sandboxOptions);
  sandboxedCtx.__nunjucks_undefined_mode = config.undefined || 'default';
  return { sandboxedCtx };
};

const buildRenderEnv = (loader, config) => {
  if (!loader || config.env) return;
  const emitter = new EventEmitter();
  config.env = createEnv({
    opts: {
      dev: config.dev ?? false,
      autoescape: config.autoescape ?? true,
      undefined: config.undefined ?? 'default'
    },
    globals: config.globals || {},
    emitter,
    async getTemplate(name, eagerCompile, includeChain, ignoreMissing) {
      const source = await loader.getSource(name);
      if (!source) {
        if (ignoreMissing) return null;
        throw createLog('error', ERROR_DEFINITIONS.FILE_NOT_FOUND, { path: name }, name, { phase: 'load' });
      }
      const { createTemplate } = await import('../template/index.js');
      return createTemplate(source.src, this, source.path, eagerCompile, includeChain);
    }
  });
};

const compileTemplate = (templateSource, config, templateName) => {
  const c = createCompiler(templateName, config.undefined, templateSource);
  const ast = parse(templateSource, config, templateName);
  const transformedAst = transform(ast, [], templateName);
  c.compile(transformedAst);
  const code = c.getCode();
  const sourceMapData = c.getSourceMap().mappings;
  return { code, sourceMapData };
};

export const render = async (template, context = {}, config = {}) => {
  config._callerFile = config._callerFile || getCallerFile();
  config._callerLocation = config._callerLocation || getCallerLocation();

  if (typeof template !== 'string') {
    const err = createLog('error', ERROR_DEFINITIONS.TEMPLATE_MUST_BE_STRING, {}, null, { phase: 'render' });
    throw wrapWithLog(err, config, template, context);
  }

  const validation = validateConfig(config);
  if (!validation.valid) {
    const validationError = validation.errors[0];
    buildValidationError(validationError, { code: validationError.code, subject: validationError.subject }, config, template, context);
  }

  const loader = getLoader(config);
  const { templateSource, templatePath } = await resolveTemplateSource(template, loader, config);
  if (templatePath) config.templatePath = templatePath;

  const templateValidation = validateTemplate(template, config);
  if (!templateValidation.valid) {
    const validationError = templateValidation.errors[0];
    buildValidationError(validationError, { lineno: validationError.lineno, colno: validationError.colno, code: validationError.code, subject: validationError.subject }, config, templateSource, context);
  }

  const contextValidation = validateRenderContext(context, config);
  if (!contextValidation.valid) {
    const contextError = contextValidation.errors[0];
    const stamps = { code: contextError.code };
    if (contextError.dangerousPaths && contextError.dangerousPaths.length > 0) {
      const callerLocation = config._callerLocation;
      if (callerLocation && callerLocation.fileName !== 'unknown') {
        const pos = findContextKeyPosition(callerLocation.fileName, callerLocation.lineNumber || 1, contextError.dangerousPaths[0]);
        if (pos) {
          stamps.lineno = pos.line;
          stamps.colno = pos.col;
          stamps.lineBase = 'one';
        }
      }
    }
    buildValidationError(contextError, stamps, config, templateSource, context);
  }

  const looksLikeFile = /\.(njk|js|html|htm|twig|ejs|eta)$/i.test(template);
  const templateName = config.templatePath || (looksLikeFile ? template : (config._callerFile || 'inline'));
  let code;
  let sourceMapData;
  try {
    ({ code, sourceMapData } = compileTemplate(templateSource, config, templateName));
  } catch (err) {
    throw wrapWithLog(err, config, templateSource, context);
  }

  const warningsCollector = [];

  const contextStrict = config.contextStrict === true || (config.contextStrict !== false && config.dev === true);
  const dangerousValuePaths = contextStrict ? findContextDangerousValues(context, config) : [];
  if (contextStrict && dangerousValuePaths.length > 0) {
    if (config.contextStrict === 'error' || config.production === true) {
      const err = new Error(`Context contains unsafe values: ${dangerousValuePaths.join(', ')}`);
      err.code = 'DANGEROUS_CONTEXT_VALUES';
      err.subject = dangerousValuePaths.join(', ');
      throw wrapWithLog(err, config, templateSource, context);
    }
    scrubDangerousReferences(context, config.allowedGlobals);
    const warning = createLog('warning', {
      name: 'DANGEROUS_CONTEXT_VALUE_SCRUBBED',
      message: () => `Scrubbed unsafe values from context: ${dangerousValuePaths.join(', ')}`,
      pattern: /./
    }, { values: dangerousValuePaths.join(', ') }, dangerousValuePaths.join(', '), {
      phase: 'render',
      templateName: templateName,
      lineBase: 'zero',
      dev: config.dev ?? false
    });
    warningsCollector.push(warning);
  }

  const { sandboxedCtx } = prepareSandbox(config, context);

  buildRenderEnv(loader, config);

  let result;
  try {
    const renderPromise = execute(code, sandboxedCtx, {
      ...config,
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

export const renderWithEnv = async (templateName, env, context = {}, config = {}) => {
  const validation = validateConfig(config);
  if (!validation.valid) {
    const validationError = validation.errors[0];
    const err = new Error(validationError.message);
    err.code = validationError.code;
    err.subject = validationError.subject;
    throw wrapWithLog(err, { ...config, templatePath: config.templatePath || templateName, env }, null, context);
  }

  const contextValidation = validateRenderContext(context, config);
  if (!contextValidation.valid) {
    const contextError = contextValidation.errors[0];
    const err = new Error(contextError.message);
    err.code = contextError.code;
    if (contextError.dangerousPaths && contextError.dangerousPaths.length > 0) {
      const callerLocation = config._callerLocation;
      if (callerLocation && callerLocation.fileName !== 'unknown') {
        const pos = findContextKeyPosition(callerLocation.fileName, callerLocation.lineNumber || 1, contextError.dangerousPaths[0]);
        if (pos) {
          err.lineno = pos.line;
          err.colno = pos.col;
          err.lineBase = 'one';
        }
      }
    }
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
