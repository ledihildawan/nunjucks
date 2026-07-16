import { setGlobalConfig, getGlobalConfig, mergeConfig, resetConfig } from './config/global.js';
import { render, renderWithEnv } from './core/render.js';
import { createEngine } from './integrations/express.js';
import { createLog, toText, toAnsi, toHtml, toConsoleString, classify, CSS, PRODUCTION_BODY, TOGGLE_SCRIPT } from '@nunjucks/log';

const getCallerLocation = () => {
  const stack = new Error().stack;
  if (!stack) return null;
  const lines = stack.split('\n');
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    let match = line.match(/at\s+.+\s+\((.+):(\d+):(\d+)\)/);
    if (match) {
      const path = match[1];
      if (path.includes('/nunjucks/src/') || path.includes('\\nunjucks\\src\\')) {
        continue;
      }
      return { path, line: parseInt(match[2]), col: parseInt(match[3]) };
    }
    match = line.match(/at\s+(.+):(\d+):(\d+)$/);
    if (match) {
      const path = match[1];
      if (path.includes('/nunjucks/src/') || path.includes('\\nunjucks\\src\\')) {
        continue;
      }
      return { path, line: parseInt(match[2]), col: parseInt(match[3]) };
    }
  }
  return null;
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
  return nunjucks;
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
