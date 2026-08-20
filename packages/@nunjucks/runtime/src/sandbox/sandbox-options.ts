import type { Environment } from '@nunjucks/shared';

/**
 * Host-supplied sandbox configuration; every field is optional and resolved
 * fail-closed by `resolveSandboxOptions`.
 */
interface SandboxOptions {
  allowlist?: readonly string[];
  blocklistMode?: boolean;
  blockedContextKeys?: readonly string[];
  environment?: Environment;
  topLevel?: boolean;
}

/** `SandboxOptions` with every field made required (minus per-call `topLevel`). */
type ResolvedSandboxOptions = {
  /** Resolved to a Set for O(1) membership checks on the hot-path. */
  readonly allowlist: ReadonlySet<string>;
  readonly blocklistMode: boolean;
  /** Resolved to a Set for O(1) membership checks on the hot-path. */
  readonly blockedContextKeys: ReadonlySet<string>;
  readonly environment: Environment;
};

// WHY: a missing allowlist resolves to an empty Set — an ACTIVE deny-all check in allowlist mode
// (blocklistMode: false), not a "no allowlist" pass-through. Blocklist mode never consults
// the allowlist, so the empty Set default is inert there. This keeps `sandboxMode: 'allowlist'`
// without entries fail-closed at the resolution boundary (config validation stays permissive).
/**
 * Resolves sandbox options with fail-closed defaults.
 * @param options - Optional sandbox configuration.
 * @returns Resolved options with required fields and O(1) Set-based lookups.
 */
const resolveSandboxOptions = (options: SandboxOptions = {}): ResolvedSandboxOptions => ({
  allowlist: new Set(options.allowlist ?? []),
  blocklistMode: options.blocklistMode ?? true,
  blockedContextKeys: new Set(options.blockedContextKeys ?? []),
  environment: options.environment ?? 'auto',
});

export type { ResolvedSandboxOptions, SandboxOptions };
export { resolveSandboxOptions };
