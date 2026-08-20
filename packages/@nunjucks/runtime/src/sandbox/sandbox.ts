import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { hasOwn, isFunction, isKeyedObject, isNonNullish } from '@nunjucks/lib';
import {
  ACCESS_PATH,
  createPropertyNotFoundCallable,
  memberLookup,
  NULL_MARKER,
  PARENT_NAME,
} from '../member-access.ts';
import { assertAllowed, type DynamicCallable, sandboxError } from './sandbox-errors.ts';
import type { ResolvedSandboxOptions, SandboxOptions } from './sandbox-options.ts';
import { resolveSandboxOptions } from './sandbox-options.ts';
import { isBlockedAtScope, isBlockedSymbol } from './sandbox-predicates.ts';
import {
  createSandboxedObject,
  createSandboxTraps,
  wrapFunctionWithBlocking,
} from './sandbox-traps.ts';

/** Inputs to `createSandboxedContext`: the context value, the toggle, and sandbox options. */
interface SandboxedContextInput {
  context: unknown;
  sandboxEnabled: boolean;
  options?: SandboxOptions;
}

/**
 * Wraps the render context object in a top-level sandboxed Proxy — passing the
 * value through untouched when sandboxing is off or the context is not an
 * object — so template variable reads are policed from the first access.
 *
 * @param options - Context value, sandbox toggle, and sandbox options.
 * @returns The original context, or a sandboxed Proxy if enabled.
 */
const createSandboxedContext = ({
  context,
  sandboxEnabled,
  options = {},
}: SandboxedContextInput): unknown => {
  const sandboxOptions = resolveSandboxOptions(options);
  if (!sandboxEnabled) {
    return context;
  }
  if (!context || typeof context !== 'object') {
    return context;
  }
  return new Proxy(
    context as object,
    createSandboxTraps({ sandboxEnabled, sandboxOptions, topLevel: true })
  );
};

interface ValidateStringAccessInput {
  value: string;
  sandboxOptions: ResolvedSandboxOptions;
  topLevel: boolean;
}

const validateStringAccess = ({
  value,
  sandboxOptions,
  topLevel,
}: ValidateStringAccessInput): void => {
  // WHY: member-lookup runtime path integrated with generated template code that uses throw-based control flow; converting to Result would require rewriting the entire runtime contract.
  if (isBlockedAtScope({ key: value, sandboxOptions, topLevel })) {
    throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_ACCESS, key: value, sandboxOptions });
  }
  assertAllowed(value, sandboxOptions);
};

interface HandleSymbolAccessInput {
  target: unknown;
  value: symbol;
  sandboxOptions: ResolvedSandboxOptions;
}

const handleSymbolAccess = ({
  target,
  value,
  sandboxOptions,
}: HandleSymbolAccessInput): unknown => {
  // WHY: mirrors the Proxy get trap's symbol branch — blocked symbols throw SANDBOX_ACCESS and
  // inherited symbol properties must not leak; only own properties are readable.
  if (isBlockedSymbol(value)) {
    throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_ACCESS, key: value, sandboxOptions });
  }
  if (!isKeyedObject(target)) {
    return undefined;
  }
  return hasOwn(target, value) ? target[value] : undefined;
};

const handlePropertyNotFound = (value: string | symbol, parentName: string | null): unknown => {
  return createPropertyNotFoundCallable(value, parentName);
};

/** Inputs to `wrapMemberAccess`: target, key, toggle, options, and the parent display name. */
interface WrapMemberAccessInput {
  target: unknown;
  value: string | symbol;
  sandboxEnabled: boolean;
  options?: SandboxOptions;
  parentName?: string | null;
}

/**
 * Performs one sandboxed member read for generated code: validates the key
 * (blocked keys throw, allowlist applies), returns typed miss sentinels for
 * null targets and missing own properties, wraps functions with blocking, and
 * recursively proxies object values. Sandboxing-off delegates to
 * `memberLookup` so both paths share identical lookup semantics.
 *
 * @param options - Target, key, sandbox toggle, options, and parent display name.
 * @returns The accessed value, a miss sentinel, or a sandboxed proxy.
 * @throws {Error} When a blocked or non-allowed key is accessed.
 */
const wrapMemberAccess = ({
  target,
  value,
  sandboxEnabled,
  options = {},
  parentName = null,
}: WrapMemberAccessInput): unknown => {
  const sandboxOptions = resolveSandboxOptions(options);
  const topLevel = options.topLevel ?? false;

  if (!sandboxEnabled) {
    // WHY: delegate to memberLookup so the public surface is identical with/without the
    // sandbox — same not-found sentinels for missing properties, same receiver-bound
    // function reads, same prototype-escape RCE guard (the old raw `record[value]` fork
    // leaked inherited functions and bare `undefined` for misses).
    return memberLookup(target, value, parentName);
  }
  if (typeof value === 'symbol') {
    return handleSymbolAccess({ target, value, sandboxOptions });
  }
  validateStringAccess({ value, sandboxOptions, topLevel });
  if (!isNonNullish(target)) {
    return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: value };
  }
  // WHY: isNonNullish above rules out null/undefined but not primitives; the index signature
  // models the dynamic string-keyed read (primitives box transparently at runtime).
  const record = target as Record<string, unknown>;
  if (!hasOwn(record, value)) {
    return handlePropertyNotFound(value, parentName);
  }
  const accessedValue = record[value];
  if (isFunction(accessedValue)) {
    return wrapFunctionWithBlocking({
      // WHY: isFunction narrows to Function, which carries no compatible variadic call
      // signature; DynamicCallable re-asserts the invocation contract for the wrapper.
      fn: accessedValue as DynamicCallable,
      sandboxEnabled,
      key: value,
      sandboxOptions,
      thisArg: record,
    });
  }
  if (typeof accessedValue === 'object' && isNonNullish(accessedValue)) {
    return createSandboxedObject({ value: accessedValue, sandboxEnabled, sandboxOptions });
  }
  return accessedValue;
};

export type { SandboxedContextInput, WrapMemberAccessInput };
export { createSandboxedContext, wrapMemberAccess };
