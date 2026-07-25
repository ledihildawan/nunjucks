import type { RenderConfig } from '../core/render.ts';

export const withAutoescape = (enabled: boolean = true) => 
  (config: RenderConfig): RenderConfig => ({
    ...config,
    autoescape: enabled,
  });
