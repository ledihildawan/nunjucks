import { getBlockedKeyCategory } from '@nunjucks/shared';
import type { ResolvedSandboxOptions } from './sandbox-options.ts';

const DANGEROUS_OBJECT_INTRINSICS = new Set(['__proto__', 'constructor', 'prototype']);

const isBlockedSymbol = (key: symbol): boolean => {
  const desc = key.description;
  if (!desc) { return true; }
  if (desc.startsWith('Symbol.')) { return false; }
  return true;
};

const isAllowedKey = (key: string, allowlist: string[] | null | undefined): boolean => {
  if (!(allowlist && Array.isArray(allowlist)) || allowlist.length === 0) {
    return true;
  }
  return allowlist.includes(key);
};

const isBlockedAtScope = (key: string | symbol, options: ResolvedSandboxOptions, topLevel = false): boolean => {
  if (typeof key === 'symbol') { return false; }
  const category = getBlockedKeyCategory(key as string, options.environment);
  if (!category) { return false; }
  return topLevel || category === 'object_intrinsic';
};

const isInternalKey = (key: string | symbol): boolean => {
  if (typeof key !== 'string') { return false; }
  return key === '__nunjucks' || key.startsWith('__nunjucks_');
};

export { DANGEROUS_OBJECT_INTRINSICS, isBlockedSymbol, isAllowedKey, isBlockedAtScope, isInternalKey };
