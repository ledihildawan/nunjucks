import { isCodeExecutionPattern, getBlockedKeyCategory, isNonNullish, isFunction, hasOwn } from '@nunjucks/shared';
import { createLog, ERROR_DEFINITIONS, type ErrorDefinitionEntry, type TemplateError, type TemplateWarning } from '@nunjucks/log';
import { NULL_MARKER, PARENT_NAME, ACCESS_PATH, PROP_NOT_FOUND } from '../member-access.ts';
import { resolveSandboxOptions } from './sandbox-options.ts';
import type { SandboxOptions, ResolvedSandboxOptions } from './sandbox-options.ts';
import { isBlockedSymbol, isAllowedKey, isBlockedAtScope, isInternalKey, DANGEROUS_OBJECT_INTRINSICS } from './sandbox-predicates.ts';

type DynamicCallable = (...args: unknown[]) => unknown;

const sandboxError = (errorDef: ErrorDefinitionEntry | undefined, key: string | symbol, options: ResolvedSandboxOptions): TemplateError | TemplateWarning => {
  if (!errorDef) {
    return createLog('error', { def: { name: 'SANDBOX_ERROR', message: `Sandbox error: ${String(key)}` }, subject: String(key), context: { phase: 'render', lineBase: 'zero' } });
  }
  const env = options.environment || 'auto';
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

const wrapFunctionWithBlocking = (
  fn: DynamicCallable,
  sandboxEnabled: boolean,
  key: string | null,
  options: ResolvedSandboxOptions,
  thisArg: unknown,
): DynamicCallable => {
  if (!(sandboxEnabled && isFunction(fn))) { return fn; }
  // WHY: this callable runs as a drop-in for the original function; throwing is the only way to surface a blocked code-execution call from a function invocation.
  return (...args) => {
    if (key && isCodeExecutionPattern(String(key)) && typeof args[0] === 'string') { throw sandboxError(ERROR_DEFINITIONS.SANDBOX_CODE_EXECUTION, key, options); }
    return fn.apply(thisArg, args);
  };
};

const assertAllowed = (key: string, sandboxOptions: ResolvedSandboxOptions): void => {
  // WHY: invoked from Proxy get/set traps where throw is the sole failure channel — Result is not expressible in a trap return.
  if (!(sandboxOptions.blocklistMode || isAllowedKey(key, sandboxOptions.allowlist))) { throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions); }
};

const createValidateGet = (
  sandboxEnabled: boolean,
  sandboxOptions: ResolvedSandboxOptions,
  topLevel: boolean,
) => {
  // WHY: the returned handler is the Proxy `get` trap; all throws below are structurally forced because a trap can only fail by throwing.
  const { blockedContextKeys } = sandboxOptions;

  const checkBlockedContextKey = (key: string): void => {
    if (topLevel && blockedContextKeys.includes(key)) { throw blockedKeysError(key, blockedContextKeys); }
  };

  const checkBlockedAtScope = (key: string, target: Record<string | symbol, unknown>): void => {
    if (isBlockedAtScope(key, sandboxOptions, topLevel) && (hasOwn(target, key) || DANGEROUS_OBJECT_INTRINSICS.has(key))) { throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ACCESS, key, sandboxOptions); }
  };

  const checkAllowlist = (key: string): void => { assertAllowed(key, sandboxOptions); };

  const validateStringKey = (target: Record<string | symbol, unknown>, key: string): unknown => {
    checkBlockedContextKey(key);
    checkBlockedAtScope(key, target);
    checkAllowlist(key);
    if (!hasOwn(target, key)) { return; }
    const value = target[key];
    if (isFunction(value)) { return wrapFunctionWithBlocking(value as DynamicCallable, sandboxEnabled, key, sandboxOptions, target); }
    if (typeof value === 'object' && isNonNullish(value)) { return createSandboxedObject(value, sandboxEnabled, sandboxOptions); }
    return value;
  };

  return (target: Record<string | symbol, unknown>, key: string | symbol): unknown => {
    if (typeof key === 'symbol') { if (isBlockedSymbol(key)) { throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ACCESS, key, sandboxOptions); } return target[key]; }
    return validateStringKey(target, key);
  };
};

const createValidateSet = (
  sandboxOptions: ResolvedSandboxOptions,
  topLevel: boolean,
) => {
  // WHY: the returned handler is the Proxy `set` trap; all throws below are structurally forced because a trap can only fail by throwing.
  const { allowlist, blocklistMode } = sandboxOptions;

  const isKeyAllowed = (key: string): boolean => blocklistMode || isAllowedKey(key, allowlist);

  const handleSymbolSet = (target: Record<string | symbol, unknown>, key: symbol, value: unknown): boolean => {
    if (isBlockedSymbol(key)) { throw sandboxError(ERROR_DEFINITIONS.SANDBOX_SET, key, sandboxOptions); }
    target[key] = value;
    return true;
  };

  const handleStringSet = (target: Record<string | symbol, unknown>, key: string, value: unknown): boolean => {
    if (topLevel && isInternalKey(key)) { target[key] = value; return true; }
    if (isBlockedAtScope(key, sandboxOptions, topLevel)) { throw sandboxError(ERROR_DEFINITIONS.SANDBOX_SET, key, sandboxOptions); }
    if (!isKeyAllowed(key)) { throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions); }
    if (topLevel) { throw sandboxError(ERROR_DEFINITIONS.SANDBOX_CONTEXT_MODIFY, key, sandboxOptions); }
    target[key] = value;
    return true;
  };

  return (target: Record<string | symbol, unknown>, key: string | symbol, value: unknown): boolean => {
    if (typeof key === 'symbol') { return handleSymbolSet(target, key, value); }
    return handleStringSet(target, key, value);
  };
};

const createValidateHas = (
  sandboxOptions: ResolvedSandboxOptions,
  topLevel: boolean,
) => {
  const { allowlist, blocklistMode } = sandboxOptions;

  return (target: Record<string | symbol, unknown>, key: string | symbol): boolean => {
    if (typeof key === 'symbol') { if (isBlockedSymbol(key)) { return false; } return key in target; }
    if (isBlockedAtScope(key, sandboxOptions, topLevel)) { return false; }
    if (topLevel && !blocklistMode && !isAllowedKey(key, allowlist)) { return false; }
    return hasOwn(target, key);
  };
};

const makeSandboxTraps = (
  sandboxEnabled: boolean,
  sandboxOptions: ResolvedSandboxOptions,
  topLevel: boolean,
): ProxyHandler<Record<string | symbol, unknown>> => {
  const validateGet = createValidateGet(sandboxEnabled, sandboxOptions, topLevel);
  const validateSet = createValidateSet(sandboxOptions, topLevel);
  const validateHas = createValidateHas(sandboxOptions, topLevel);

  return { get: validateGet, set: validateSet, has: validateHas };
};

const createSandboxedObject = (value: unknown, sandboxEnabled: boolean, options: SandboxOptions = {}): unknown => {
  const sandboxOptions = resolveSandboxOptions(options);
  if (!(sandboxEnabled && isNonNullish(value))) { return value; }
  if (typeof value !== 'object' && !isFunction(value)) { return value; }
  if (isFunction(value)) { return wrapFunctionWithBlocking(value as DynamicCallable, sandboxEnabled, null, sandboxOptions, null); }
  return new Proxy(value as object, makeSandboxTraps(sandboxEnabled, sandboxOptions, false));
};

const createSandboxedContext = (context: unknown, sandboxEnabled: boolean, options: SandboxOptions = {}): unknown => {
  const sandboxOptions = resolveSandboxOptions(options);
  if (!sandboxEnabled) { return context; }
  if (!context || typeof context !== 'object') { return context; }
  return new Proxy(context as object, makeSandboxTraps(sandboxEnabled, sandboxOptions, true));
};

const createPropertyNotFoundCallable = (value: string | symbol, parentName: string | null) => {
  const callable = Object.assign(() => undefined, { [PROP_NOT_FOUND]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: value });
  Object.setPrototypeOf(callable, null);
  return callable;
};

const validateStringAccess = (value: string, sandboxOptions: ResolvedSandboxOptions, topLevel: boolean): void => {
  // WHY: member-lookup runtime path integrated with generated template code that uses throw-based control flow; converting to Result would require rewriting the entire runtime contract.
  if (isBlockedAtScope(value, sandboxOptions, topLevel)) { throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ACCESS, value, sandboxOptions); }
  assertAllowed(value, sandboxOptions);
};

const handleSandboxDisabled = (target: unknown, value: string | symbol, parentName: string | null): unknown => {
  if (!isNonNullish(target)) { return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: value }; }
  return (target as Record<string | symbol, unknown>)[value];
};

const handleSymbolAccess = (target: unknown, value: symbol): unknown => {
  return (target as Record<string | symbol, unknown> | undefined)?.[value];
};

const handlePropertyNotFound = (value: string | symbol, parentName: string | null): unknown => {
  return createPropertyNotFoundCallable(value, parentName);
};

const wrapMemberAccess = (target: unknown, val: string | symbol, sandboxEnabled: boolean, options: SandboxOptions = {}, parentName: string | null = null): unknown => {
  const sandboxOptions = resolveSandboxOptions(options);
  const topLevel = options.topLevel ?? false;

  if (!sandboxEnabled) { return handleSandboxDisabled(target, val, parentName); }
  if (typeof val === 'symbol') { return handleSymbolAccess(target, val); }
  validateStringAccess(val, sandboxOptions, topLevel);
  if (!isNonNullish(target)) { return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: val }; }
  const record = target as Record<string, unknown>;
  if (!hasOwn(record, val)) { return handlePropertyNotFound(val, parentName); }
  const value = record[val];
  if (isFunction(value)) { return wrapFunctionWithBlocking(value as DynamicCallable, sandboxEnabled, val, sandboxOptions, record); }
  if (typeof value === 'object' && isNonNullish(value)) { return createSandboxedObject(value, sandboxEnabled, sandboxOptions); }
  return value;
};

export { resolveSandboxOptions, wrapFunctionWithBlocking, isAllowedKey, createSandboxedObject, createSandboxedContext, wrapMemberAccess };
export type { SandboxOptions, ResolvedSandboxOptions };
