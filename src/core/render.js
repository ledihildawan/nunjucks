import EventEmitter from 'events';
import { readFileSync } from 'node:fs';
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
import { createTemplate } from '../template/index.js';

const resolveTemplateSource = async (template, loader, config) => {
  if (!loader || template.includes('{{') || template.includes('{%') || template.includes('{#')) {
    return { templateSource: template, templatePath: null };
  }

  try {
    const source = await loader.getSource(template);
    if (source?.src) {
      return {
        templateSource: source.src,
        templatePath: config.templatePath ? null : source.path
      };
    }
  } catch (loaderErr) {
    const code = loaderErr?.code;
    if (code === 'ENOENT' || code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') {
      return { templateSource: template, templatePath: null };
    }
    throw loaderErr;
  }

  return { templateSource: template, templatePath: null };
};

const createValidationError = (validationError, stamps, config, templateSource, context) => {
  const err = new Error(validationError.message);
  Object.assign(err, stamps);
  throw wrapWithLog(err, config, templateSource, context);
};

const getDangerousValueStamps = (contextError, config) => {
  const stamps = { code: contextError.code };
  const dangerousPaths = contextError.dangerousPaths;
  if (!dangerousPaths?.length) return stamps;

  const callerLocation = config._callerLocation;
  if (!callerLocation || callerLocation.fileName === 'unknown') return stamps;

  const pos = findContextKeyPosition(callerLocation.fileName, callerLocation.lineNumber || 1, dangerousPaths[0]);
  if (pos) {
    stamps.lineno = pos.line;
    stamps.colno = pos.col;
    stamps.lineBase = 'one';
  }
  return stamps;
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
  return sandboxedCtx;
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
      return createTemplate(source.src, this, source.path, eagerCompile, includeChain);
    }
  });
};

const compileTemplate = (templateSource, config, templateName) => {
  const c = createCompiler(templateName, config.undefined, templateSource);
  const ast = parse(templateSource, config, templateName);
  const transformedAst = transform(ast, [], templateName);
  c.compile(transformedAst);
  return { code: c.getCode(), sourceMapData: c.getSourceMap().mappings };
};

const handleContextStrictMode = (context, config) => {
  const warningsCollector = [];
  const contextStrict = config.contextStrict === true || (config.contextStrict !== false && config.dev === true);
  const dangerousValuePaths = contextStrict ? findContextDangerousValues(context, config) : [];

  if (!contextStrict || dangerousValuePaths.length === 0) {
    return { warningsCollector, dangerousValuePaths };
  }

  const errorMessage = `Context contains unsafe values: ${dangerousValuePaths.join(', ')}`;

  if (config.contextStrict === 'error' || config.production === true) {
    const err = new Error(errorMessage);
    err.code = 'DANGEROUS_CONTEXT_VALUES';
    err.subject = dangerousValuePaths.join(', ');
    throw wrapWithLog(err, config, null, context);
  }

  scrubDangerousReferences(context, config.allowedGlobals);
  warningsCollector.push(createLog('warning', {
    name: 'DANGEROUS_CONTEXT_VALUE_SCRUBBED',
    message: () => `Scrubbed unsafe values from context: ${dangerousValuePaths.join(', ')}`,
    pattern: /./
  }, { values: dangerousValuePaths.join(', ') }, dangerousValuePaths.join(', '), {
    phase: 'render',
    lineBase: 'zero',
    dev: config.dev ?? false
  }));

  return { warningsCollector, dangerousValuePaths };
};

const validateRenderInput = (template, config, context) => {
  if (typeof template !== 'string') {
    const err = createLog('error', ERROR_DEFINITIONS.TEMPLATE_MUST_BE_STRING, {}, null, { phase: 'render' });
    throw wrapWithLog(err, config, template, context);
  }

  const validation = validateConfig(config);
  if (!validation.valid) {
    const ve = validation.errors[0];
    createValidationError(ve, { code: ve.code, subject: ve.subject }, config, template, context);
  }

  const templateValidation = validateTemplate(template, config);
  if (!templateValidation.valid) {
    const ve = templateValidation.errors[0];
    createValidationError(ve, { lineno: ve.lineno, colno: ve.colno, code: ve.code, subject: ve.subject }, config, template, context);
  }

  const contextValidation = validateRenderContext(context, config);
  if (!contextValidation.valid) {
    const ce = contextValidation.errors[0];
    const stamps = getDangerousValueStamps(ce, config);
    createValidationError(ce, stamps, config, template, context);
  }
};

export const render = async (template, context = {}, config = {}) => {
  config._callerFile = config._callerFile || getCallerFile();
  config._callerLocation = config._callerLocation || getCallerLocation();

  validateRenderInput(template, config, context);

  // Inline templates belong to the source file that called render(). Only
  // infer caller metadata when the exact template exists in that file; this
  // avoids treating a helper's own call site as the source of dynamic strings.
  if (config._autoCallerLocation && !config.jsCaller && config._callerFile && config._callerFile !== 'unknown') {
    try {
      const callerLine = config._callerLocation?.lineNumber;
      const source = readFileSync(config._callerFile, 'utf8');
      let searchFrom = 0;
      let foundNearCaller = false;
      while (callerLine != null) {
        const templateIndex = source.indexOf(template, searchFrom);
        if (templateIndex === -1) break;
        const occurrenceLine = source.slice(0, templateIndex).split('\n').length;
        if (Math.abs(occurrenceLine - callerLine) <= 5) {
          foundNearCaller = true;
          break;
        }
        searchFrom = templateIndex + 1;
      }
      if (foundNearCaller) {
        config.jsCaller = config._callerFile;
      }
    } catch {
      // Diagnostics will fall back to the template source when the caller
      // cannot be read.
    }
  }
  if (config.jsCaller && config.jsCallerErrorLine == null) {
    config.jsCallerErrorLine = config._callerLocation?.lineNumber ?? 1;
  }
  if (config.jsCaller && config.jsCallerErrorCol == null) {
    config.jsCallerErrorCol = config._callerLocation?.columnNumber ?? 1;
  }
  const loader = getLoader(config);
  const { templateSource, templatePath } = await resolveTemplateSource(template, loader, config);
  if (templatePath) config.templatePath = templatePath;

  const looksLikeFile = /\.(njk|js|html|htm|twig|ejs|eta)$/i.test(template);
  const templateName = config.templatePath || (looksLikeFile ? template : (config._callerFile || 'inline'));

  let code;
  let sourceMapData;
  try {
    ({ code, sourceMapData } = compileTemplate(templateSource, config, templateName));
  } catch (err) {
    throw wrapWithLog(err, config, templateSource, context);
  }

  const { warningsCollector } = handleContextStrictMode(context, config);
  const sandboxedCtx = prepareSandbox(config, context);
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

    result = config.executionTimeout > 0
      ? await withTimeout(renderPromise, config.executionTimeout)
      : await renderPromise;
  } catch (err) {
    throw wrapWithLog(err, config, templateSource, context);
  }

  if (warningsCollector.length > 0 && config.dev) {
    result = result + injectWarningsScript(warningsCollector, { dev: true, verbosity: 'medium' });
  }

  return result;
};

export const renderWithEnv = async (templateName, env, context = {}, config = {}) => {
  const fullConfig = { ...config, templatePath: config.templatePath || templateName, env };

  const validation = validateConfig(config);
  if (!validation.valid) {
    const ve = validation.errors[0];
    const err = createLog('error', {
      name: ve.code || 'CONFIG_ERROR',
      message: () => ve.message,
      pattern: /./,
    }, {}, ve.message, {
      phase: 'render',
      templateName: fullConfig.templatePath,
      lineBase: 'zero'
    });
    throw wrapWithLog(err, fullConfig, null, context);
  }

  const contextValidation = validateRenderContext(context, config);
  if (!contextValidation.valid) {
    const ce = contextValidation.errors[0];
    const stamps = getDangerousValueStamps(ce, config);
    const err = createLog('error', {
      name: ce.code || 'CONTEXT_ERROR',
      message: () => ce.message,
      pattern: /./,
    }, {}, ce.message, {
      phase: 'render',
      templateName: fullConfig.templatePath,
      lineBase: 'zero',
      ...stamps
    });
    throw wrapWithLog(err, fullConfig, null, context);
  }

  let template;
  try {
    template = await env.getTemplate(templateName, true, templateName, false);

    if (typeof template.render === 'function') {
      return await template.render(context);
    }

    throw createLog('error', ERROR_DEFINITIONS.TEMPLATE_NO_RENDER, {}, null, { phase: 'render' });
  } catch (err) {
    throw wrapWithLog(err, fullConfig, template?.tmplStr ?? null, context);
  }
};
