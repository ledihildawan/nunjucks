import { setGlobalConfig, mergeConfig } from './config/global.js';
import { render } from './core/render.js';

const nunjucks = (template, context, localConfig) => {
  if (template === undefined) {
    return nunjucks;
  }

  if (typeof template === 'object' && template !== null) {
    setGlobalConfig(template);
    return nunjucks;
  }

  const config = mergeConfig(localConfig || {});
  config._autoCallerLocation = true;
  if (localConfig?.filters) config._customFilters = localConfig.filters;
  if (localConfig?.globals) config._customGlobals = localConfig.globals;

  if (context && typeof context === 'object' && !localConfig) {
    return render(template, context, config);
  }

  if (context && typeof context === 'object' && localConfig) {
    const mergedConfig = { ...config, ...localConfig };
    if (localConfig.filters) mergedConfig._customFilters = localConfig.filters;
    if (localConfig.globals) mergedConfig._customGlobals = localConfig.globals;
    return render(template, context, mergedConfig);
  }

  return (ctx) => render(template, ctx || {}, config);
};

nunjucks.render = (template, context, localConfig) => {
  const config = mergeConfig(localConfig || {});
  config._autoCallerLocation = true;
  if (localConfig?.filters) config._customFilters = localConfig.filters;
  if (localConfig?.globals) config._customGlobals = localConfig.globals;
  return render(template, context, config);
};

export default nunjucks;
