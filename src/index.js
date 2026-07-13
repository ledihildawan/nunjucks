import { setGlobalConfig, getGlobalConfig, mergeConfig, resetConfig } from './config/global.js';
import { renderString, renderStringSync, compileTemplate, render, isTemplateString, detectTemplateType } from './core/render.js';

const Result = {
  success: (value) => ({ ok: true, value, error: undefined }),
  failure: (error) => ({ ok: false, value: undefined, error }),
};

const nunjucks = (template, context, localConfig) => {
  if (template === undefined) {
    return nunjucks;
  }

  if (typeof template === 'object' && template !== null) {
    setGlobalConfig(template);
    return nunjucks;
  }

  if (typeof template !== 'string') {
    throw new Error('Template must be a string');
  }

  const config = mergeConfig(localConfig || {});

  if (context && typeof context === 'object' && !localConfig) {
    return renderString(template, context, config);
  }

  if (context && typeof context === 'object' && localConfig) {
    const mergedConfig = { ...config, ...localConfig };
    return renderString(template, context, mergedConfig);
  }

  return (ctx) => renderString(template, ctx || {}, config);
};

nunjucks.configure = (globalConfig) => {
  if (globalConfig) {
    setGlobalConfig(globalConfig);
  }
  return nunjucks;
};

nunjucks.render = async (template, context = {}, config = {}) => {
  return renderString(template, context, mergeConfig(config));
};

nunjucks.renderSync = async (template, context = {}, config = {}) => {
  return renderStringSync(template, context, mergeConfig(config));
};

nunjucks.renderString = async (template, context = {}, config = {}) => {
  return renderString(template, context, mergeConfig(config));
};

nunjucks.renderStringSync = async (template, context = {}, config = {}) => {
  return renderStringSync(template, context, mergeConfig(config));
};

nunjucks.compile = (template, config = {}) => {
  return compileTemplate(template, mergeConfig(config));
};

nunjucks.getConfig = getGlobalConfig;

nunjucks.setConfig = setGlobalConfig;

nunjucks.resetConfig = resetConfig;

nunjucks.isTemplateString = isTemplateString;

nunjucks.detectTemplateType = detectTemplateType;

nunjucks.Result = Result;

nunjucks.version = '3.2.4';

export default nunjucks;

export {
  setGlobalConfig,
  getGlobalConfig,
  mergeConfig,
  resetConfig,
  renderString,
  renderStringSync,
  compileTemplate,
  render,
  isTemplateString,
  detectTemplateType,
  Result
};
