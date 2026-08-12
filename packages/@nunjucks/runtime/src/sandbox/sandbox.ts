import { isCodeExecutionPattern, getBlockedKeyCategory } from '@nunjucks/validators/security';
import { isNonNullish, isFunction, hasOwn } from '@nunjucks/lib';
import { createLog } from '@nunjucks/error-formatter';
import type { ErrorDefinitionEntry, TemplateError, TemplateWarning } from '@nunjucks/error-formatter';
import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { NULL_MARKER, PARENT_NAME, ACCESS_PATH, PROP_NOT_FOUND } from '../member-access.ts';
import { resolveSandboxOptions } from './sandbox-options.ts';
import type { SandboxOptions, ResolvedSandboxOptions } from './sandbox-options.ts';
import { isBlockedSymbol, isAllowedKey, isBlockedAtScope, isInternalKey, DANGEROUS_OBJECT_INTRINSICS } from './sandbox-predicates.ts';

type DynamicCallable = (...args: unknown[]) => unknown;

interface SandboxErrorInput {
  errorDef: ErrorDefinitionEntry | undefined;
  key: string | symbol;
  sandboxOptions: ResolvedSandboxOptions;
}

// WHY: sandbox errors are thrown from Proxy traps where throw is the sole failure channel; the error shape is enriched with the blocked key's category for diagnostics.
const sandboxError = ({ errorDef, key, sandboxOptions }: SandboxErrorInput): TemplateError | TemplateWarning => {
  if (!errorDef) {
    return createLog('error', { def: { name: 'SANDBOX_ERROR', message: `Sandbox error: ${String(key)}` }, subject: String(key), context: { phase: 'render', lineBase: 'zero' } });
  }
  const env = sandboxOptions.environment ?? 'auto';
  const category = getBlockedKeyCategory(String(key), env);
  return createLog('error', { def: errorDef, params: { key: String(key), category: category ?? '', environment: env }, subject: String(key), context: { phase: 'render', lineBase: 'zero' } });
};

const blockedKeysError = (key: string, blockedKeys: readonly string[]): TemplateError | TemplateWarning => {
  const errorDef = ERROR_DEFINITIONS.BLOCKED_CONTEXT_KEYS;
  if (!errorDef) {
    const err = createLog('error', { def: { name: 'BLOCKED_CONTEXT_KEYS', message: `Blocked context key: ${key}` }, subject: key, context: { phase: 'render', lineBase: 'zero' } });
    Object.assign(err, { blockedKeys });
    return err;
  }
  const created = createLog('error', { def: errorDef, params: { keys: blockedKeys.join(', ') }, subject: key, context: { phase: 'render', lineBase: 'zero' } });
  if (created && typeof created === 'object') {
    Object.assign(created, { blockedKeys });
  }
  return created;
};

interface WrapFunctionBlockingInput {
  fn: DynamicCallable;
  sandboxEnabled: boolean;
  key: string | null;
  sandboxOptions: ResolvedSandboxOptions;
  thisArg: unknown;
}

const wrapFunctionWithBlocking = ({ fn, sandboxEnabled, key, sandboxOptions, thisArg }: WrapFunctionBlockingInput): DynamicCallable => {
  if (!(sandboxEnabled && isFunction(fn))) { return fn; }
  // WHY: this callable runs as a drop-in for the original function; throwing is the only way to surface a blocked code-execution call from a function invocation.
  return (...args) => {
    if (key && isCodeExecutionPattern(String(key)) && typeof args[0] === 'string') { throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_CODE_EXECUTION, key, sandboxOptions }); }
    return fn.apply(thisArg, args);
  };
};

const assertAllowed = (key: string, sandboxOptions: ResolvedSandboxOptions): void => {
  // WHY: invoked from Proxy get/set traps where throw is the sole failure channel — Result is not expressible in a trap return.
  if (!(sandboxOptions.blocklistMode || isAllowedKey(key, sandboxOptions.allowlist))) { throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions }); }
};

interface ValidateHandlerInput {
  sandboxEnabled: boolean;
  sandboxOptions: ResolvedSandboxOptions;
  topLevel: boolean;
}

const createValidateGet = ({ sandboxEnabled, sandboxOptions, topLevel }: ValidateHandlerInput) => {
  // WHY: the returned handler is the Proxy `get` trap; all throws below are structurally forced because a trap can only fail by throwing.
  const { blockedContextKeys } = sandboxOptions;

  const checkBlockedContextKey = (key: string): void => {
    if (topLevel && blockedContextKeys.includes(key)) { throw blockedKeysError(key, blockedContextKeys); }
  };

  const checkBlockedAtScope = (key: string, target: Record<string | symbol, unknown>): void => {
    if (isBlockedAtScope({ key, sandboxOptions, topLevel }) && (hasOwn(target, key) || DANGEROUS_OBJECT_INTRINSICS.has(key))) { throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_ACCESS, key, sandboxOptions }); }
  };

  const checkAllowlist = (key: string): void => { assertAllowed(key, sandboxOptions); };

  const validateStringKey = (target: Record<string | symbol, unknown>, key: string): unknown => {
    checkBlockedContextKey(key);
    checkBlockedAtScope(key, target);
    checkAllowlist(key);
    if (!hasOwn(target, key)) { return; }
    const value = target[key];
    if (isFunction(value)) { return wrapFunctionWithBlocking({ fn: value as DynamicCallable, sandboxEnabled, key, sandboxOptions, thisArg: target }); }
    if (typeof value === 'object' && isNonNullish(value)) { return createSandboxedObject({ value, sandboxEnabled, sandboxOptions }); }
    return value;
  };

  return (target: Record<string | symbol, unknown>, key: string | symbol): unknown => {
    if (typeof key === 'symbol') { if (isBlockedSymbol(key)) { throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_ACCESS, key, sandboxOptions }); } return target[key]; }
    return validateStringKey(target, key);
  };
};

interface ValidateSetOptions {
  sandboxOptions: ResolvedSandboxOptions;
  topLevel: boolean;
}

const createValidateSet = ({ sandboxOptions, topLevel }: ValidateSetOptions) => {
  // WHY: the returned handler is the Proxy `set` trap; all throws below are structurally forced because a trap can only fail by throwing.
  const { allowlist, blocklistMode } = sandboxOptions;

  const isKeyAllowed = (key: string): boolean => blocklistMode || isAllowedKey(key, allowlist);

  const handleSymbolSet = (target: Record<string | symbol, unknown>, key: symbol, value: unknown): boolean => {
    if (isBlockedSymbol(key)) { throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_SET, key, sandboxOptions }); }
    target[key] = value;
    return true;
  };

  const handleStringSet = (target: Record<string | symbol, unknown>, key: string, value: unknown): boolean => {
    if (topLevel && isInternalKey(key)) { target[key] = value; return true; }
    if (isBlockedAtScope({ key, sandboxOptions, topLevel })) { throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_SET, key, sandboxOptions }); }
    if (!isKeyAllowed(key)) { throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions }); }
    if (topLevel) { throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_CONTEXT_MODIFY, key, sandboxOptions }); }
    target[key] = value;
    return true;
  };

  return (target: Record<string | symbol, unknown>, key: string | symbol, value: unknown): boolean => {
    if (typeof key === 'symbol') { return handleSymbolSet(target, key, value); }
    return handleStringSet(target, key, value);
  };
};

interface ValidateHasOptions {
  sandboxOptions: ResolvedSandboxOptions;
  topLevel: boolean;
}

const createValidateHas = ({ sandboxOptions, topLevel }: ValidateHasOptions) => {
  const { allowlist, blocklistMode } = sandboxOptions;

  return (target: Record<string | symbol, unknown>, key: string | symbol): boolean => {
    if (typeof key === 'symbol') { if (isBlockedSymbol(key)) { return false; } return key in target; }
    if (isBlockedAtScope({ key, sandboxOptions, topLevel })) { return false; }
    if (topLevel && !blocklistMode && !isAllowedKey(key, allowlist)) { return false; }
    return hasOwn(target, key);
  };
};

const makeSandboxTraps = ({ sandboxEnabled, sandboxOptions, topLevel }: ValidateHandlerInput): ProxyHandler<Record<string | symbol, unknown>> => {
  const validateGet = createValidateGet({ sandboxEnabled, sandboxOptions, topLevel });
  const validateSet = createValidateSet({ sandboxOptions, topLevel });
  const validateHas = createValidateHas({ sandboxOptions, topLevel });

  return { get: validateGet, set: validateSet, has: validateHas };
};

interface SandboxedValueInput {
  value: unknown;
  sandboxEnabled: boolean;
  options?: SandboxOptions;
  sandboxOptions?: ResolvedSandboxOptions;
}

// WHY: accepts either unresolved SandboxOptions (resolved internally) or pre-resolved ResolvedSandboxOptions (passed through) so internal recursive callers avoid re-resolving the same config on every nested object access.
const createSandboxedObject = ({ value, sandboxEnabled, options = {}, sandboxOptions }: SandboxedValueInput): unknown => {
  const resolvedOptions = sandboxOptions ?? resolveSandboxOptions(options);
  if (!(sandboxEnabled && isNonNullish(value))) { return value; }
  if (typeof value !== 'object' && !isFunction(value)) { return value; }
  if (isFunction(value)) { return wrapFunctionWithBlocking({ fn: value as DynamicCallable, sandboxEnabled, key: null, sandboxOptions: resolvedOptions, thisArg: null }); }
  return new Proxy(value as object, makeSandboxTraps({ sandboxEnabled, sandboxOptions: resolvedOptions, topLevel: false }));
};

interface SandboxedContextInput {
  context: unknown;
  sandboxEnabled: boolean;
  options?: SandboxOptions;
}

const createSandboxedContext = ({ context, sandboxEnabled, options = {} }: SandboxedContextInput): unknown => {
  const sandboxOptions = resolveSandboxOptions(options);
  if (!sandboxEnabled) { return context; }
  if (!context || typeof context !== 'object') { return context; }
  return new Proxy(context as object, makeSandboxTraps({ sandboxEnabled, sandboxOptions, topLevel: true }));
};

const createPropertyNotFoundCallable = (value: string | symbol, parentName: string | null) => {
  const callable = Object.assign(() => undefined, { [PROP_NOT_FOUND]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: value });
  Object.setPrototypeOf(callable, null);
  return callable;
};

interface ValidateStringAccessInput {
  value: string;
  sandboxOptions: ResolvedSandboxOptions;
  topLevel: boolean;
}

const validateStringAccess = ({ value, sandboxOptions, topLevel }: ValidateStringAccessInput): void => {
  // WHY: member-lookup runtime path integrated with generated template code that uses throw-based control flow; converting to Result would require rewriting the entire runtime contract.
  if (isBlockedAtScope({ key: value, sandboxOptions, topLevel })) { throw sandboxError({ errorDef: ERROR_DEFINITIONS.SANDBOX_ACCESS, key: value, sandboxOptions }); }
  assertAllowed(value, sandboxOptions);
};

interface HandleSandboxDisabledInput {
  target: unknown;
  value: string | symbol;
  parentName: string | null;
}

const handleSandboxDisabled = ({ target, value, parentName }: HandleSandboxDisabledInput): unknown => {
  if (!isNonNullish(target)) { return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: value }; }
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

const wrapMemberAccess = ({ target, value, sandboxEnabled, options = {}, parentName = null }: WrapMemberAccessInput): unknown => {
  const sandboxOptions = resolveSandboxOptions(options);
  const topLevel = options.topLevel ?? false;

  if (!sandboxEnabled) { return handleSandboxDisabled({ target, value, parentName }); }
  if (typeof value === 'symbol') { return handleSymbolAccess(target, value); }
  validateStringAccess({ value, sandboxOptions, topLevel });
  if (!isNonNullish(target)) { return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: value }; }
  const record = target as Record<string, unknown>;
  if (!hasOwn(record, value)) { return handlePropertyNotFound(value, parentName); }
  const accessedValue = record[value];
  if (isFunction(accessedValue)) { return wrapFunctionWithBlocking({ fn: accessedValue as DynamicCallable, sandboxEnabled, key: value, sandboxOptions, thisArg: record }); }
  if (typeof accessedValue === 'object' && isNonNullish(accessedValue)) { return createSandboxedObject({ value: accessedValue, sandboxEnabled, sandboxOptions }); }
  return accessedValue;
};

export { resolveSandboxOptions, wrapFunctionWithBlocking, createSandboxedObject, createSandboxedContext, wrapMemberAccess };
export type { SandboxOptions, ResolvedSandboxOptions, SandboxedValueInput, SandboxedContextInput, WrapMemberAccessInput, WrapFunctionBlockingInput };
