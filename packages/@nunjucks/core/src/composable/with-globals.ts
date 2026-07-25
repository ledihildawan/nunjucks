import type { RenderConfig } from '../core/render.ts';

export const withGlobal = (name: string, value: unknown) => 
  (config: RenderConfig): RenderConfig => ({
    ...config,
    globals: { ...config.globals, [name]: value },
  });

export const withGlobals = (globals: Record<string, unknown>) => 
  (config: RenderConfig): RenderConfig => ({
    ...config,
    globals: { ...config.globals, ...globals },
  });
