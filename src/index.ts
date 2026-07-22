import { setGlobalConfig, mergeConfig } from './config/global.js';
import { render } from './core/render.js';
import type { RenderConfig } from './core/render.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nunjucks: any = (template?: unknown, context?: unknown, localConfig?: RenderConfig) => {
  if (template === undefined) {
    return nunjucks;
  }

  if (typeof template === 'object' && template !== null) {
    setGlobalConfig(template as RenderConfig);
    return nunjucks;
  }

  const config = mergeConfig(localConfig || {} as any);
  config._autoCallerLocation = true;
  if (localConfig?.filters) config._customFilters = localConfig.filters;
  if (localConfig?.globals) config._customGlobals = localConfig.globals;

  if (context && typeof context === 'object' && !localConfig) {
    return render(template as string, context as Record<string, unknown>, config as RenderConfig);
  }

  if (context && typeof context === 'object' && localConfig) {
    const mergedConfig = { ...config, ...localConfig } as any;
    if (localConfig.filters) mergedConfig._customFilters = localConfig.filters;
    if (localConfig.globals) mergedConfig._customGlobals = localConfig.globals;
    return render(template as string, context as Record<string, unknown>, mergedConfig as RenderConfig);
  }

  return (ctx?: Record<string, unknown>) => render(template as string, ctx || {}, config as RenderConfig);
};

nunjucks.render = (template: string, context: Record<string, unknown>, localConfig?: RenderConfig) => {
  const config = mergeConfig(localConfig || {} as any);
  config._autoCallerLocation = true;
  if (localConfig?.filters) config._customFilters = localConfig.filters;
  if (localConfig?.globals) config._customGlobals = localConfig.globals;
  return render(template, context, config as RenderConfig);
};

export default nunjucks;
