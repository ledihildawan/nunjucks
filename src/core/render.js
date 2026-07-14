import { createCompiler } from '../compiler/index.js';
import { parse } from '../parser/index.js';
import { transform } from '../transformers/index.js';
import { execute } from './compiler.js';
import { validateTemplate, validateRenderContext, validateConfig } from './validator.js';
import { withTimeout } from '../runtime/timeout.js';
import { createSandboxedContext } from '../runtime/sandbox.js';
import { renderError } from '../error/index.js';
import { createFileSystemLoader } from '../loaders/index.js';

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

const wrapErrorWithHtml = async (err, config, template = null, renderContext = null) => {
  const templateName = config.templatePath || 'renderString';
  const errorResult = await renderError(err, templateName, {
    dev: config.dev,
    ide: config.ide,
    sourceContent: template,
    templatePath: config.templatePath,
    jsCaller: config.jsCaller || null,
    jsCallerErrorLine: config.jsCallerErrorLine || null,
    renderContext
  });
  Object.assign(err, errorResult);
  return err;
};

export const render = async (template, context = {}, config = {}) => {
  const validation = validateConfig(config);
  if (!validation.valid) {
    throw new Error(validation.errors[0].message);
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
    throw new Error(templateValidation.errors[0].message);
  }

  const contextValidation = validateRenderContext(context, config);
  if (!contextValidation.valid) {
    throw new Error(contextValidation.errors[0].message);
  }

  let code;
  const templateName = config.templatePath || 'renderString';
  try {
    const c = createCompiler(templateName, config.undefined, templateSource);
    const ast = parse(templateSource, config, templateName);
    const transformedAst = transform(ast, [], templateName);
    c.compile(transformedAst);
    code = c.getCode();
  } catch (err) {
    throw await wrapErrorWithHtml(err, config, templateSource, context);
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

  const renderPromise = execute(code, sandboxedCtx, {
    ...config,
    runtime
  });

  try {
    if (config.executionTimeout > 0) {
      return await withTimeout(renderPromise, config.executionTimeout);
    }
    return await renderPromise;
  } catch (err) {
    throw await wrapErrorWithHtml(err, config, templateSource, context);
  }
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
    throw new Error(validation.errors[0].message);
  }

  const contextValidation = validateRenderContext(context, config);
  if (!contextValidation.valid) {
    throw new Error(contextValidation.errors[0].message);
  }

  let template;
  try {
    template = await env.getTemplate(templateName, true, templateName, false);
    
    if (typeof template.render === 'function') {
      const result = await template.render(context);
      return result;
    }
    
    throw new Error('Template does not have a render method');
  } catch (err) {
    throw await wrapErrorWithHtml(err, { ...config, templatePath: config.templatePath || templateName, env }, template?.tmplStr ?? null, context);
  }
};
