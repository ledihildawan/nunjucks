import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { hasOwn, isFunction, isNonNullish } from '@nunjucks/lib';
import { ACCESS_PATH, NULL_MARKER, PARENT_NAME, PROP_NOT_FOUND } from '../member-access.ts';
import { assertAllowed, type DynamicCallable, sandboxError } from './sandbox-errors.ts';
import type { ResolvedSandboxOptions, SandboxOptions } from './sandbox-options.ts';
import { resolveSandboxOptions } from './sandbox-options.ts';
import { isBlockedAtScope } from './sandbox-predicates.ts';
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

const createPropertyNotFoundCallable = (value: string | symbol, parentName: string | null) => {
  const callable = Object.assign(() => undefined, {
    [PROP_NOT_FOUND]: true,
    [PARENT_NAME]: parentName,
    [ACCESS_PATH]: value,
  });
  Object.setPrototypeOf(callable, null);
  return callable;
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
  return (target as Record<string | symbol, unknown>)[value];
};

const handleSymbolAccess = (target: unknown, value: symbol): unknown => {
  return (target as Record<string | symbol, unknown> | undefined)?.[value];
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
    return handleSymbolAccess(target, value);
  }
  validateStringAccess({ value, sandboxOptions, topLevel });
  if (!isNonNullish(target)) {
    return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: value };
  }
  const record = target as Record<string, unknown>;
  if (!hasOwn(record, value)) {
    return handlePropertyNotFound(value, parentName);
  }
  const accessedValue = record[value];
  if (isFunction(accessedValue)) {
    return wrapFunctionWithBlocking({
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
