import type { Environment } from '@nunjucks/validators/security';

interface SandboxOptions {
  allowlist?: readonly string[];
  blocklistMode?: boolean;
  blockedContextKeys?: readonly string[];
  environment?: Environment;
  topLevel?: boolean;
}

type ResolvedSandboxOptions = Required<Omit<SandboxOptions, 'topLevel'>>;

const resolveSandboxOptions = (options: SandboxOptions = {}): ResolvedSandboxOptions => ({
  allowlist: options.allowlist ?? [],
  blocklistMode: options.blocklistMode ?? true,
  blockedContextKeys: options.blockedContextKeys ?? [],
  environment: options.environment ?? 'auto',
});

export type { ResolvedSandboxOptions, SandboxOptions };
export { resolveSandboxOptions };
