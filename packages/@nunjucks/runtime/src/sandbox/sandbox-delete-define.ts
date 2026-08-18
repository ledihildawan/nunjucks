import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { hasOwn } from '@nunjucks/lib';
import {
  DANGEROUS_OBJECT_INTRINSICS,
  isAllowedKey,
  isBlockedAtScope,
  isBlockedSymbol,
  isInternalKey,
} from './sandbox-predicates.ts';
import type { ResolvedSandboxOptions } from './sandbox-options.ts';
import { sandboxError } from './sandbox-errors.ts';

interface ValidateSetOptions {
  sandboxOptions: ResolvedSandboxOptions;
  topLevel: boolean;
}

/** Shared guard: symbol keys are blocked for write operations. */
const guardBlockedSymbol = (key: string | symbol, sandboxOptions: ResolvedSandboxOptions): void => {
  if (typeof key === 'symbol' && isBlockedSymbol(key)) {
    throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_SET, key, sandboxOptions });
  }
};

/** Shared guard for write operations: throws SANDBOX_SET if the key is blocked at scope. */
const guardBlockedStringKey = (
  key: string,
  target: Record<string | symbol, unknown>,
  sandboxOptions: ResolvedSandboxOptions,
  topLevel: boolean
): void => {
  if (
    isBlockedAtScope({ key, sandboxOptions, topLevel }) &&
    (hasOwn(target, key) || DANGEROUS_OBJECT_INTRINSICS.has(key))
  ) {
    throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_SET, key, sandboxOptions });
  }
};

/** Throws SANDBOX_ALLOWLIST for a key not in the allowlist. */
const guardAllowlist = (key: string, sandboxOptions: ResolvedSandboxOptions): void => {
  if (!sandboxOptions.blocklistMode && !isAllowedKey(key, sandboxOptions.allowlist)) {
    throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions });
  }
};

/** Throws SANDBOX_CONTEXT_MODIFY for top-level context mutation. */
const guardTopLevelContextMutation = (
  key: string,
  sandboxOptions: ResolvedSandboxOptions
): never => {
  throw sandboxError({
    errorDef: ERROR_DEFINITIONS.SANDBOX_CONTEXT_MODIFY,
    key,
    sandboxOptions,
  });
};

/** Validates a string key for a write operation (set/delete/defineProperty). */
const validateStringKeyForWrite = (
  key: string,
  target: Record<string | symbol, unknown>,
  sandboxOptions: ResolvedSandboxOptions,
  topLevel: boolean
): boolean => {
  if (topLevel && isInternalKey(key)) {
    return true;
  }
  guardBlockedStringKey(key, target, sandboxOptions, topLevel);
  guardAllowlist(key, sandboxOptions);
  if (topLevel) {
    guardTopLevelContextMutation(key, sandboxOptions);
  }
  return true;
};

/** Builds the Proxy `deleteProperty` trap: internal keys allowed, blocked categories fail-closed. */
const createValidateDeleteProperty = ({ sandboxOptions, topLevel }: ValidateSetOptions) => {
  return (target: Record<string | symbol, unknown>, key: string | symbol): boolean => {
    guardBlockedSymbol(key, sandboxOptions);
    if (
      typeof key === 'string' &&
      !validateStringKeyForWrite(key, target, sandboxOptions, topLevel)
    ) {
      return false;
    }
    return delete target[key];
  };
};

/** Builds the Proxy `defineProperty` trap: blocked categories and top-level writes fail-closed. */
const createValidateDefineProperty = ({ sandboxOptions, topLevel }: ValidateSetOptions) => {
  return (
    target: Record<string | symbol, unknown>,
    key: string | symbol,
    descriptor: PropertyDescriptor
  ): boolean => {
    guardBlockedSymbol(key, sandboxOptions);
    if (typeof key === 'string') {
      if (!validateStringKeyForWrite(key, target, sandboxOptions, topLevel)) {
        return false;
      }
      return Reflect.defineProperty(target, key, descriptor);
    }
    return Reflect.defineProperty(target, key, descriptor);
  };
};

export { createValidateDeleteProperty, createValidateDefineProperty };
export type { ValidateSetOptions };
