import { setGlobalConfig, getGlobalConfig } from './config/global.js';
import { render } from './core/render.js';
import type { RenderConfig } from './core/render.js';

const nunjucks = (template?: unknown, context?: unknown, localConfig?: RenderConfig): unknown => {
  if (template === undefined) {
    return nunjucks;
  }

  if (typeof template === 'object' && template !== null) {
    setGlobalConfig(template);
    return nunjucks;
  }

  const baseConfig = getGlobalConfig() as unknown as RenderConfig;
  const config: RenderConfig = { ...baseConfig };
  if (localConfig) {
    Object.assign(config, localConfig);
  }
  config.filters = { ...(baseConfig.filters as Record<string, unknown>), ...((localConfig?.filters ?? {}) as Record<string, unknown>) };
  config.globals = { ...(baseConfig.globals as Record<string, unknown>), ...((localConfig?.globals ?? {}) as Record<string, unknown>) };
  config._autoCallerLocation = true;
  if (localConfig?.filters) config._customFilters = localConfig.filters as Record<string, unknown>;
  if (localConfig?.globals) config._customGlobals = localConfig.globals as Record<string, unknown>;

  if (context && typeof context === 'object' && !localConfig) {
    return render(template as string, context as Record<string, unknown>, config);
  }

  if (context && typeof context === 'object' && localConfig) {
    const mergedConfig: RenderConfig = { ...config, ...localConfig };
    mergedConfig.filters = { ...(config.filters as Record<string, unknown>), ...((localConfig.filters ?? {}) as Record<string, unknown>) };
    mergedConfig.globals = { ...(config.globals as Record<string, unknown>), ...((localConfig.globals ?? {}) as Record<string, unknown>) };
    if (localConfig.filters) mergedConfig._customFilters = localConfig.filters as Record<string, unknown>;
    if (localConfig.globals) mergedConfig._customGlobals = localConfig.globals as Record<string, unknown>;
    return render(template as string, context as Record<string, unknown>, mergedConfig);
  }

  return (ctx?: Record<string, unknown>) => render(template as string, ctx ?? {}, config);
};

nunjucks.render = (template: string, context: Record<string, unknown>, localConfig?: RenderConfig) => {
  const baseConfig = getGlobalConfig() as unknown as RenderConfig;
  const config: RenderConfig = { ...baseConfig };
  if (localConfig) {
    Object.assign(config, localConfig);
  }
  config.filters = { ...(baseConfig.filters as Record<string, unknown>), ...((localConfig?.filters ?? {}) as Record<string, unknown>) };
  config.globals = { ...(baseConfig.globals as Record<string, unknown>), ...((localConfig?.globals ?? {}) as Record<string, unknown>) };
  config._autoCallerLocation = true;
  if (localConfig?.filters) config._customFilters = localConfig.filters as Record<string, unknown>;
  if (localConfig?.globals) config._customGlobals = localConfig.globals as Record<string, unknown>;
  return render(template, context, config);
};

export default nunjucks;
