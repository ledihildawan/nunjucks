import { getBlockedKeyCategory } from '@nunjucks/shared';
import type { ResolvedSandboxOptions } from './sandbox-options.ts';

// WHY: this set is consulted alongside `hasOwn(target, key)` in the Proxy `get` trap. Only the three keys that are inherited from `Object.prototype` via a property-accessor (rather than a plain inherited method) need to be flagged when the key is NOT an own property — those three (`__proto__`, `constructor`, `prototype`) are reachable even on `{}` because they are accessor properties on the prototype. The other intrinsics (`toString`, `hasOwnProperty`, etc.) are inherited methods, not accessors, so they don't need an extra gate; the `hasOwn` check alone properly short-circuits them.
const DANGEROUS_OBJECT_INTRINSICS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

const isBlockedSymbol = (key: symbol): boolean => {
  const desc = key.description;
  if (!desc) {
    return true;
  }
  if (desc.startsWith('Symbol.')) {
    return false;
  }
  return true;
};

// WHY: an absent allowlist (null/undefined) means "allowlist not configured" — blocklist-mode
// callers pass none, so everything is allowed. An EMPTY array is different: allowlist mode with
// nothing allowlisted must DENY ALL (fail-closed), never degrade into allow-everything.
const isAllowedKey = (key: string, allowlist: readonly string[] | null | undefined): boolean => {
  if (!(allowlist && Array.isArray(allowlist))) {
    return true;
  }
  return allowlist.includes(key);
};

interface BlockedAtScopeInput {
  key: string | symbol;
  sandboxOptions: ResolvedSandboxOptions;
  topLevel: boolean;
}

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
