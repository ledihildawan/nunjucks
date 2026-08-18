import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { hasOwn, isFunction, isNonNullish } from '@nunjucks/lib';
import { isCodeExecutionPattern, isDangerousReference } from '@nunjucks/security';
import {
  assertAllowed,
  blockedKeysError,
  type DynamicCallable,
  sandboxError,
} from './sandbox-errors.ts';
import type { ResolvedSandboxOptions, SandboxOptions } from './sandbox-options.ts';
import { resolveSandboxOptions } from './sandbox-options.ts';
import {
  DANGEROUS_OBJECT_INTRINSICS,
  isAllowedKey,
  isBlockedAtScope,
  isBlockedSymbol,
  isInternalKey,
} from './sandbox-predicates.ts';

/** Inputs to `wrapFunctionWithBlocking`: the function, its key, scope, and receiver. */
interface WrapFunctionBlockingInput {
  fn: DynamicCallable;
  sandboxEnabled: boolean;
  key: string | null;
  sandboxOptions: ResolvedSandboxOptions;
  thisArg: unknown;
}

/**
 * Wraps a function so calling it with a string first argument under a
 * code-execution key (falling back to `fn.name` when `key` is null) throws
 * `SANDBOX_CODE_EXECUTION`; everything else forwards to the original.
 */
const wrapFunctionWithBlocking = ({
  fn,
  sandboxEnabled,
  key,
  sandboxOptions,
  thisArg,
}: WrapFunctionBlockingInput): DynamicCallable => {
  if (!(sandboxEnabled && isFunction(fn))) {
    return fn;
  }
  // WHY: this callable runs as a drop-in for the original function; throwing is the only way to surface a blocked code-execution call from a function invocation.
  // WHY: defense-in-depth — when the caller passes `key: null` (standalone function entry point, no property name), fall back to `fn.name` so `globalThis.fetch('alert(1)')` still triggers SANDBOX_CODE_EXECUTION.
  const effectiveKey = key ?? (typeof fn.name === 'string' ? fn.name : null);
  return (...args) => {
    if (effectiveKey && isCodeExecutionPattern(effectiveKey) && typeof args[0] === 'string') {
      throw sandboxError({
        errorDef: ERROR_DEFINITIONS.SANDBOX_CODE_EXECUTION,
        key: effectiveKey,
        sandboxOptions,
      });
    }
    return fn.apply(thisArg, args);
  };
};

interface ValidateHandlerInput {
  sandboxEnabled: boolean;
  sandboxOptions: ResolvedSandboxOptions;
  topLevel: boolean;
}

/** Builds the Proxy `get` trap enforcing blocked keys, depth guards, and the allowlist. */
const createValidateGet = ({ sandboxEnabled, sandboxOptions, topLevel }: ValidateHandlerInput) => {
  // WHY: the returned handler is the Proxy `get` trap; all throws below are structurally forced because a trap can only fail by throwing.
  const { blockedContextKeys } = sandboxOptions;

  const checkBlockedContextKey = (key: string): void => {
    if (topLevel && blockedContextKeys.includes(key)) {
      throw blockedKeysError(key, blockedContextKeys);
    }
  };

  const checkBlockedAtScope = (key: string, target: Record<string | symbol, unknown>): void => {
    if (
      isBlockedAtScope({ key, sandboxOptions, topLevel }) &&
      (hasOwn(target, key) || DANGEROUS_OBJECT_INTRINSICS.has(key))
    ) {
      throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_ACCESS, key, sandboxOptions });
    }
  };

  const checkAllowlist = (key: string): void => {
    assertAllowed(key, sandboxOptions);
  };

  const validateStringKey = (target: Record<string | symbol, unknown>, key: string): unknown => {
    checkBlockedContextKey(key);
    checkBlockedAtScope(key, target);
    checkAllowlist(key);
    if (!hasOwn(target, key)) {
      return;
    }
    const value = target[key];
    // WHY: depth guard — env globals (process/globalThis/window…) are key-blocked only at
    // top level, but a host context can NEST the real reference (`{ user: { process } }`).
    // A value that IS a dangerous reference is refused at ANY depth: sandboxing must not
    // be escapable by smuggling the global one level down.
    if (isDangerousReference(value)) {
      throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_ACCESS, key, sandboxOptions });
    }
    if (isFunction(value)) {
      return wrapFunctionWithBlocking({
        fn: value as DynamicCallable,
        sandboxEnabled,
        key,
        sandboxOptions,
        thisArg: target,
      });
    }
    if (typeof value === 'object' && isNonNullish(value)) {
      return createSandboxedObject({ value, sandboxEnabled, sandboxOptions });
    }
    return value;
  };

  return (target: Record<string | symbol, unknown>, key: string | symbol): unknown => {
    if (typeof key === 'symbol') {
      if (isBlockedSymbol(key)) {
        throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_ACCESS, key, sandboxOptions });
      }
      // WHY: own-property check prevents prototype-chain symbol access (e.g. a Symbol-defined property on Object.prototype would otherwise leak through `target[key]`).
      return hasOwn(target, key) ? target[key] : undefined;
    }
    return validateStringKey(target, key);
  };
};

interface ValidateSetOptions {
  sandboxOptions: ResolvedSandboxOptions;
  topLevel: boolean;
}

/** Builds the Proxy `set` trap; internal keys, blocked keys, and top-level writes each throw their own error. */
const createValidateSet = ({ sandboxOptions, topLevel }: ValidateSetOptions) => {
  // WHY: the returned handler is the Proxy `set` trap; all throws below are structurally forced because a trap can only fail by throwing.
  const { allowlist, blocklistMode } = sandboxOptions;

  const isKeyAllowed = (key: string): boolean => blocklistMode || isAllowedKey(key, allowlist);

  const handleSymbolSet = (
    target: Record<string | symbol, unknown>,
    key: symbol,
    value: unknown
  ): boolean => {
    if (isBlockedSymbol(key)) {
      throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_SET, key, sandboxOptions });
    }
    target[key] = value;
    return true;
  };

  const handleStringSet = (
    target: Record<string | symbol, unknown>,
    key: string,
    value: unknown
  ): boolean => {
    if (topLevel && isInternalKey(key)) {
      target[key] = value;
      return true;
    }
    if (isBlockedAtScope({ key, sandboxOptions, topLevel })) {
      throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_SET, key, sandboxOptions });
    }
    if (!isKeyAllowed(key)) {
      throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions });
    }
    if (topLevel) {
      throw sandboxError({
        errorDef: ERROR_DEFINITIONS.SANDBOX_CONTEXT_MODIFY,
        key,
        sandboxOptions,
      });
    }
    target[key] = value;
    return true;
  };

  return (
    target: Record<string | symbol, unknown>,
    key: string | symbol,
    value: unknown
  ): boolean => {
    if (typeof key === 'symbol') {
      return handleSymbolSet(target, key, value);
    }
    return handleStringSet(target, key, value);
  };
};

interface ValidateHasOptions {
  sandboxOptions: ResolvedSandboxOptions;
  topLevel: boolean;
}

/** Builds the Proxy `has` trap: blocked keys and non-allowed keys report absent, own properties only. */
const createValidateHas = ({ sandboxOptions, topLevel }: ValidateHasOptions) => {
  const { allowlist, blocklistMode } = sandboxOptions;

  return (target: Record<string | symbol, unknown>, key: string | symbol): boolean => {
    if (typeof key === 'symbol') {
      if (isBlockedSymbol(key)) {
        return false;
      }
      // WHY: own-property check prevents inherited-symbol presence from leaking through the `in` operator (which walks the prototype chain).
      return hasOwn(target, key);
    }
    if (isBlockedAtScope({ key, sandboxOptions, topLevel })) {
      return false;
    }
    if (topLevel && !blocklistMode && !isAllowedKey(key, allowlist)) {
      return false;
    }
    return hasOwn(target, key);
  };
};

/** Assembles the validating `get`/`set`/`has` trap set for one sandboxed Proxy. */
const createSandboxTraps = ({
  sandboxEnabled,
  sandboxOptions,
  topLevel,
}: ValidateHandlerInput): ProxyHandler<Record<string | symbol, unknown>> => {
  const validateGet = createValidateGet({ sandboxEnabled, sandboxOptions, topLevel });
  const validateSet = createValidateSet({ sandboxOptions, topLevel });
  const validateHas = createValidateHas({ sandboxOptions, topLevel });

  return { get: validateGet, set: validateSet, has: validateHas };
};

/** Inputs to `createSandboxedObject`, accepting pre-resolved options for recursion. */
interface SandboxedValueInput {
  value: unknown;
  sandboxEnabled: boolean;
  options?: SandboxOptions;
  sandboxOptions?: ResolvedSandboxOptions;
}

/**
 * Proxies an object (or wraps a function) so every nested access is trapped;
 * accepts pre-resolved options so recursion does not re-resolve the config.
 */
// WHY: accepts either unresolved SandboxOptions (resolved internally) or pre-resolved ResolvedSandboxOptions (passed through) so internal recursive callers avoid re-resolving the same config on every nested object access.
const createSandboxedObject = ({
  value,
  sandboxEnabled,
  options = {},
  sandboxOptions,
}: SandboxedValueInput): unknown => {
  const resolvedOptions = sandboxOptions ?? resolveSandboxOptions(options);
  if (!(sandboxEnabled && isNonNullish(value))) {
    return value;
  }
  if (typeof value !== 'object' && !isFunction(value)) {
    return value;
  }
  if (isFunction(value)) {
    return wrapFunctionWithBlocking({
      fn: value as DynamicCallable,
      sandboxEnabled,
      key: null,
      sandboxOptions: resolvedOptions,
      thisArg: null,
    });
  }
  return new Proxy(
    value as object,
    createSandboxTraps({ sandboxEnabled, sandboxOptions: resolvedOptions, topLevel: false })
  );
};

export type { SandboxedValueInput, WrapFunctionBlockingInput };
export { createSandboxedObject, createSandboxTraps, wrapFunctionWithBlocking };
