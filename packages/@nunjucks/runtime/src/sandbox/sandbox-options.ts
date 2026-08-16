import type { Environment } from '@nunjucks/shared';

interface SandboxOptions {
  allowlist?: readonly string[];
  blocklistMode?: boolean;
  blockedContextKeys?: readonly string[];
  environment?: Environment;
  topLevel?: boolean;
}

type ResolvedSandboxOptions = Required<Omit<SandboxOptions, 'topLevel'>>;

// WHY: a missing allowlist resolves to [] — an ACTIVE deny-all check in allowlist mode
// (blocklistMode: false), not a "no allowlist" pass-through. Blocklist mode never consults
// the allowlist, so the [] default is inert there. This keeps `sandboxMode: 'allowlist'`
// without entries fail-closed at the resolution boundary (config validation stays permissive).
const resolveSandboxOptions = (options: SandboxOptions = {}): ResolvedSandboxOptions => ({
  allowlist: options.allowlist ?? [],
  blocklistMode: options.blocklistMode ?? true,
  blockedContextKeys: options.blockedContextKeys ?? [],
  environment: options.environment ?? 'auto',
});

export type { ResolvedSandboxOptions, SandboxOptions };
export { resolveSandboxOptions };
