import type { RenderConfig } from '../core/render.ts';

export const withViews = (views: string | string[]) => 
  (config: RenderConfig): RenderConfig => ({
    ...config,
    views,
  });
