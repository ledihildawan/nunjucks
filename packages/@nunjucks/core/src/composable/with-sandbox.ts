import type { RenderConfig } from '../core/render.ts';

export interface SandboxOptions {
  allowlist?: string[];
  blocklistMode?: boolean;
  environment?: 'auto' | 'node' | 'browser' | 'deno';
}

export const withSandbox = (options: SandboxOptions = {}) => 
  (config: RenderConfig): RenderConfig => ({
    ...config,
    sandbox: true,
    sandboxAllowlist: options.allowlist ?? [],
    sandboxMode: options.blocklistMode === false ? 'allowlist' : 'blocklist',
    sandboxEnvironment: options.environment ?? 'auto',
  });
