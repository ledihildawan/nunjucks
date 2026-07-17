import { setGlobalConfig, getGlobalConfig, mergeConfig, resetConfig } from './config/global.js';
import { render, renderWithEnv } from './core/render.js';
import { createEngine } from './integrations/express.js';
import { createLog, toText, toAnsi, toHtml, toConsoleString, classify, CSS, PRODUCTION_BODY, TOGGLE_SCRIPT } from '@nunjucks/log';

const getCallerLocation = () => {
  const original = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stack) => stack;
  const stack = new Error().stack;
  Error.prepareStackTrace = original;

  if (!stack || stack.length < 3) return null;

  const skipPrefixes = ['/nunjucks/src/', '\\nunjucks\\src\\'];

  for (let i = 2; i < stack.length; i++) {
    const frame = stack[i];
    if (!frame || typeof frame.getFileName !== 'function') continue;

    const fileName = frame.getFileName();
    if (!fileName) continue;

    const normalizedFile = fileName.replace(/\\/g, '/');
    const shouldSkip = skipPrefixes.some(prefix => normalizedFile.includes(prefix));
    if (shouldSkip) continue;

    return {
      path: fileName,
      line: frame.getLineNumber?.() || null,
      col: frame.getColumnNumber?.() || null
    };
  }

  return null;
};

const createConfiguredInstance = () => {
  const configured = (template, context, localConfig) => nunjucks(template, context, localConfig);
  return Object.assign(configured, nunjucks);
};

const nunjucks = (template, context, localConfig) => {
  if (template === undefined) {
    return nunjucks;
  }

  if (typeof template === 'object' && template !== null) {
    setGlobalConfig(template);
    return nunjucks;
  }

  const callerLoc = getCallerLocation();
  const config = mergeConfig(localConfig || {});

  if (localConfig?.filters) {
    config._customFilters = localConfig.filters;
  }
  if (localConfig?.globals) {
    config._customGlobals = localConfig.globals;
  }

  if (callerLoc) {
    config.jsCaller = callerLoc.path;
    config.jsCallerErrorLine = callerLoc.line;
    config.jsCallerErrorCol = callerLoc.col;
  }

  if (context && typeof context === 'object' && !localConfig) {
    return render(template, context, config);
  }

  if (context && typeof context === 'object' && localConfig) {
    const mergedConfig = { ...config, ...localConfig };
    if (localConfig.filters) {
      mergedConfig._customFilters = localConfig.filters;
    }
    if (localConfig.globals) {
      mergedConfig._customGlobals = localConfig.globals;
    }
    return render(template, context, mergedConfig);
  }

  return (ctx) => render(template, ctx || {}, config);
};

nunjucks.configure = (globalConfig) => {
  if (globalConfig) {
    setGlobalConfig(globalConfig);
  }
  return createConfiguredInstance();
};

nunjucks.render = render;

nunjucks.renderWithEnv = renderWithEnv;

nunjucks.getConfig = getGlobalConfig;

nunjucks.setConfig = setGlobalConfig;

nunjucks.resetConfig = resetConfig;

nunjucks.version = '3.2.4';

export default nunjucks;

export {
  setGlobalConfig,
  getGlobalConfig,
  mergeConfig,
  resetConfig,
  render,
  renderWithEnv,
  createEngine,
  createLog,
  toText,
  toAnsi,
  toHtml,
  toConsoleString,
  classify,
  CSS,
  PRODUCTION_BODY,
  TOGGLE_SCRIPT
};
