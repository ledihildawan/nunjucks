import type { RenderConfig } from '../core/render.ts';

export const withCache = (enabled: boolean = true) => 
  (config: RenderConfig): RenderConfig => ({
    ...config,
    cache: enabled,
  });
