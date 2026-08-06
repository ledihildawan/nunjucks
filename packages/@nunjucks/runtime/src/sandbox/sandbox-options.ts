import type { Environment } from '@nunjucks/shared';

interface SandboxOptions {
  allowlist?: readonly string[];
  blocklistMode?: boolean;
  blockedContextKeys?: readonly string[];
  environment?: Environment;
  env?: Environment;
  topLevel?: boolean;
}

type ResolvedSandboxOptions = Required<Omit<SandboxOptions, 'topLevel' | 'env'>>;

const resolveSandboxOptions = (options: SandboxOptions = {}): ResolvedSandboxOptions => ({
  allowlist: options.allowlist || [],
  blocklistMode: options.blocklistMode ?? true,
  blockedContextKeys: options.blockedContextKeys || [],
  environment: options.environment || options.env || 'auto',
});

export { resolveSandboxOptions };
export type { SandboxOptions, ResolvedSandboxOptions };
