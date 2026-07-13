import { compile, execute } from './compiler.js';
import { validateTemplate, validateRenderContext, validateConfig } from './validator.js';
import { withTimeout, withTimeoutSync } from '../runtime/timeout.js';
import { createSandboxedContext } from '../runtime/sandbox.js';

export const renderString = async (template, context = {}, config = {}) => {
  const validation = validateConfig(config);
  if (!validation.valid) {
    throw new Error(validation.errors[0].message);
  }

  const templateValidation = validateTemplate(template, config);
  if (!templateValidation.valid) {
    throw new Error(templateValidation.errors[0].message);
  }

  const contextValidation = validateRenderContext(context, config);
  if (!contextValidation.valid) {
    throw new Error(contextValidation.errors[0].message);
  }

  const code = compile(template, { ...config, name: 'renderString' });
  
  const sandboxedCtx = createSandboxedContext(context, config.sandbox);
  sandboxedCtx.__nunjucks_undefined_mode = config.undefined || 'default';
  
  const runtime = buildRuntime(config);

  const renderPromise = execute(code, sandboxedCtx, { 
    ...config, 
    runtime 
  });

  if (config.executionTimeout > 0) {
    return withTimeout(renderPromise, config.executionTimeout);
  }

  return renderPromise;
};

export const renderStringSync = async (template, context = {}, config = {}) => {
  const validation = validateConfig(config);
  if (!validation.valid) {
    throw new Error(validation.errors[0].message);
  }

  const templateValidation = validateTemplate(template, config);
  if (!templateValidation.valid) {
    throw new Error(templateValidation.errors[0].message);
  }

  const contextValidation = validateRenderContext(context, config);
  if (!contextValidation.valid) {
    throw new Error(contextValidation.errors[0].message);
  }

  const code = compile(template, { ...config, name: 'renderString' });
  
  const sandboxedCtx = createSandboxedContext(context, config.sandbox);
  sandboxedCtx.__nunjucks_undefined_mode = config.undefined || 'default';
  
  const runtime = buildRuntime(config);

  const renderFn = () => execute(code, sandboxedCtx, { ...config, runtime });

  if (config.executionTimeout > 0) {
    return withTimeoutSync(renderFn, config.executionTimeout);
  }

  return renderFn();
};

export const compileTemplate = (template, config = {}) => {
  return compile(template, { ...config, name: config.name || 'template' });
};

export const render = (template, context = {}, config = {}) => {
  return renderString(template, context, config);
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

export const isTemplateString = (template) => {
  return typeof template === 'string' && !template.endsWith('.njk') && !template.includes('/') && !template.includes('\\');
};

export const detectTemplateType = (template) => {
  if (typeof template !== 'string') {
    return 'invalid';
  }

  if (isTemplateString(template)) {
    return 'string';
  }

  return 'file';
};
