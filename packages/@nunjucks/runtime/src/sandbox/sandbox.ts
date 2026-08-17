import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { hasOwn, isFunction, isKeyedObject, isNonNullish } from '@nunjucks/lib';
import { isPrototypeEscapeKey } from '@nunjucks/shared';
import {
  ACCESS_PATH,
  createPropertyNotFoundCallable,
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

interface SandboxedContextInput {
  context: unknown;
  sandboxEnabled: boolean;
  options?: SandboxOptions;
}

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

interface HandleSandboxDisabledInput {
  target: unknown;
  value: string | symbol;
  parentName: string | null;
}

const handleSandboxDisabled = ({
  target,
  value,
  parentName,
}: HandleSandboxDisabledInput): unknown => {
  if (!isNonNullish(target)) {
    return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: value };
  }
  // WHY: target is guaranteed non-null by the guard above; the index signature models a dynamic
  // property read on an arbitrary host value (primitives box transparently).
  const record = target as Record<string | symbol, unknown>;
  // WHY: defense-in-depth for a currently-unreachable wiring — sandbox-disabled configs use
  // memberLookup (member-access.ts), which carries this same isPrototypeEscapeKey && !hasOwn
  // not-found treatment. wrapMemberAccess is a public runtime surface, so if a future wiring
  // routes sandbox-disabled lookups here, the RCE guard must not be skippable.
  if (typeof value === 'string' && isPrototypeEscapeKey(value) && !hasOwn(record, value)) {
    return createPropertyNotFoundCallable(value, parentName);
  }
  return record[value];
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

interface WrapMemberAccessInput {
  target: unknown;
  value: string | symbol;
  sandboxEnabled: boolean;
  options?: SandboxOptions;
  parentName?: string | null;
}

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
    return handleSandboxDisabled({ target, value, parentName });
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
