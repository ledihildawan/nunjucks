import { setGlobalConfig, getGlobalConfig, mergeConfig, resetConfig } from './config/global.js';
import { render, renderWithEnv } from './core/render.js';
import { createEngine } from './integrations/express.js';

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

  if (typeof template !== 'string') {
    throw new Error('Template must be a string');
  }

  const callerLoc = getCallerLocation();
  const config = mergeConfig(localConfig || {});

  if (callerLoc) {
    config.jsCaller = callerLoc.path;
    config.jsCallerErrorLine = callerLoc.line;
  }

  if (context && typeof context === 'object' && !localConfig) {
    return render(template, context, config);
  }

  if (context && typeof context === 'object' && localConfig) {
    const mergedConfig = { ...config, ...localConfig };
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
  createEngine
};
