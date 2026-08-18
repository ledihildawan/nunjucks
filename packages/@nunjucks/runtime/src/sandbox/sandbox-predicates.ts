import { getBlockedKeyCategory } from '@nunjucks/security';
import type { ResolvedSandboxOptions } from './sandbox-options.ts';

// WHY: this set is consulted alongside `hasOwn(target, key)` in the Proxy `get` trap. Only the three keys that are inherited from `Object.prototype` via a property-accessor (rather than a plain inherited method) need to be flagged when the key is NOT an own property — those three (`__proto__`, `constructor`, `prototype`) are reachable even on `{}` because they are accessor properties on the prototype. The other intrinsics (`toString`, `hasOwnProperty`, etc.) are inherited methods, not accessors, so they don't need an extra gate; the `hasOwn` check alone properly short-circuits them.
/**
 * The `Object.prototype` accessor intrinsics reachable even on `{}`;
 * consulted alongside the own-property check in the Proxy `get` trap.
 */
const DANGEROUS_OBJECT_INTRINSICS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * Well-known `Symbol.*` intrinsics that are safe to expose in sandboxed contexts.
 * Identity comparison replaces the string-prefix check to prevent bypass via
 * forged descriptions like `Symbol('Symbol.iterator')`.  `Symbol.for` and
 * `Symbol.keyFor` are not well-known symbols themselves — they are the global
 * symbol registry API — so only the actual well-known symbol values are listed.
 */
const WELL_KNOWN_SYMBOLS: ReadonlySet<symbol> = new Set<symbol>([
  Symbol.iterator,
  Symbol.toStringTag,
  Symbol.hasInstance,
  Symbol.isConcatSpreadable,
  Symbol.match,
  Symbol.replace,
  Symbol.search,
  Symbol.split,
  Symbol.asyncIterator,
]);

/**
 * Narrows to blocked symbols: descriptionless and user symbols are blocked;
 * well-known `Symbol.*` intrinsics are allowed (identity-matched, not string-prefixed).
 */
const isBlockedSymbol = (key: symbol): boolean => {
  if (!key.description) {
    return true;
  }
  return !WELL_KNOWN_SYMBOLS.has(key);
};

// WHY: an absent allowlist (null/undefined) means "allowlist not configured" — blocklist-mode
// callers pass none, so everything is allowed. An EMPTY set is different: allowlist mode with
// nothing allowlisted must DENY ALL (fail-closed), never degrade into allow-everything.
// `ResolvedSandboxOptions.allowlist` is already a `ReadonlySet<string>` after Batch 1 B2.
const isAllowedKey = (key: string, allowlist: ReadonlySet<string> | null | undefined): boolean => {
  if (!allowlist) {
    return true;
  }
  return allowlist.has(key);
};

interface BlockedAtScopeInput {
  key: string | symbol;
  sandboxOptions: ResolvedSandboxOptions;
  topLevel: boolean;
}

/** Decides whether a blocked-category key is refused at this scope (top level or intrinsic). */
const isBlockedAtScope = ({ key, sandboxOptions, topLevel }: BlockedAtScopeInput): boolean => {
  if (typeof key === 'symbol') {
    return false;
  }
  const category = getBlockedKeyCategory(key as string, sandboxOptions.environment);
  if (!category) {
    return false;
  }
  return topLevel || category === 'object_intrinsic';
};

/** Recognizes engine-internal keys (`__nunjucks` / `__nunjucks_*`) exempt from set blocking. */
const isInternalKey = (key: string | symbol): boolean => {
  if (typeof key !== 'string') {
    return false;
  }
  return key === '__nunjucks' || key.startsWith('__nunjucks_');
};

export {
  DANGEROUS_OBJECT_INTRINSICS,
  isAllowedKey,
  isBlockedAtScope,
  isBlockedSymbol,
  isInternalKey,
};
