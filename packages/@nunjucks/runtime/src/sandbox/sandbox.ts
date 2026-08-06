import { isCodeExecutionPattern, getBlockedKeyCategory, isNonNullish, isFunction, hasOwn } from '@nunjucks/shared';
import { createLog, ERROR_DEFINITIONS, type ErrorDefinitionEntry, type TemplateError, type TemplateWarning } from '@nunjucks/log';
import { NULL_MARKER, PARENT_NAME, ACCESS_PATH, PROP_NOT_FOUND } from '../member-access.ts';
import { resolveSandboxOptions } from './sandbox-options.ts';
import type { SandboxOptions, ResolvedSandboxOptions } from './sandbox-options.ts';
import { isBlockedSymbol, isAllowedKey, isBlockedAtScope, isInternalKey, DANGEROUS_OBJECT_INTRINSICS } from './sandbox-predicates.ts';

const sandboxError = (errorDef: ErrorDefinitionEntry | undefined, key: string | symbol, options: ResolvedSandboxOptions): TemplateError | TemplateWarning => {
  if (!errorDef) {
    return createLog('error', { name: 'SANDBOX_ERROR', message: `Sandbox error: ${String(key)}` }, undefined, String(key), { phase: 'render', lineBase: 'zero' });
  }
  const env = options.environment || 'auto';
  const category = getBlockedKeyCategory(String(key), env);
  return createLog('error', errorDef, { key: String(key), category: category ?? '', environment: env }, String(key), { phase: 'render', lineBase: 'zero' });
};

const blockedKeysError = (key: string, blockedKeys: readonly string[]): TemplateError | TemplateWarning => {
  const errorDef = ERROR_DEFINITIONS.BLOCKED_CONTEXT_KEYS;
  if (!errorDef) {
    const err = createLog('error', { name: 'BLOCKED_CONTEXT_KEYS', message: `Blocked context key: ${key}` }, undefined, key, { phase: 'render', lineBase: 'zero' });
    (err as { blockedKeys?: readonly string[] }).blockedKeys = blockedKeys;
    return err;
  }
  const created = createLog('error', errorDef, { keys: blockedKeys.join(', ') }, key, { phase: 'render', lineBase: 'zero' });
  if (created && typeof created === 'object') {
    (created as { blockedKeys?: readonly string[] }).blockedKeys = blockedKeys;
  }
  return created;
};

const wrapFunctionWithBlocking = (
  fn: (...args: unknown[]) => unknown,
  sandboxEnabled: boolean,
  key: string | null,
  options: ResolvedSandboxOptions,
  thisArg: unknown,
): ((...args: unknown[]) => unknown) => {
  if (!(sandboxEnabled && isFunction(fn))) { return fn; }
  return (...args: unknown[]) => {
    if (key && isCodeExecutionPattern(String(key)) && typeof args[0] === 'string') { throw sandboxError(ERROR_DEFINITIONS.SANDBOX_CODE_EXECUTION, key, options); }
    return fn.apply(thisArg, args);
  };
};

const assertAllowed = (key: string, sandboxOptions: ResolvedSandboxOptions): void => {
  if (!(sandboxOptions.blocklistMode || isAllowedKey(key, sandboxOptions.allowlist))) { throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions); }
};

const createValidateGet = (
  sandboxEnabled: boolean,
  sandboxOptions: ResolvedSandboxOptions,
  topLevel: boolean,
) => {
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
    if (isFunction(value)) { return wrapFunctionWithBlocking(value as (...args: unknown[]) => unknown, sandboxEnabled, key, sandboxOptions, target); }
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

const createSandboxedObject = (obj: unknown, sandboxEnabled: boolean, options: SandboxOptions = {}): unknown => {
  const sandboxOptions = resolveSandboxOptions(options);
  if (!(sandboxEnabled && isNonNullish(obj))) { return obj; }
  if (typeof obj !== 'object' && !isFunction(obj)) { return obj; }
  if (isFunction(obj)) { return wrapFunctionWithBlocking(obj as (...args: unknown[]) => unknown, sandboxEnabled, null, sandboxOptions, null); }
  return new Proxy(obj as object, makeSandboxTraps(sandboxEnabled, sandboxOptions, false));
};

const createSandboxedContext = (context: unknown, sandboxEnabled: boolean, options: SandboxOptions = {}): unknown => {
  const sandboxOptions = resolveSandboxOptions(options);
  if (!sandboxEnabled) { return context; }
  if (!context || typeof context !== 'object') { return context; }
  return new Proxy(context as object, makeSandboxTraps(sandboxEnabled, sandboxOptions, true));
};

const createPropertyNotFoundCallable = (val: string | symbol, parentName: string | null) => {
  const callable = Object.assign(() => undefined, { [PROP_NOT_FOUND]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: val });
  Object.setPrototypeOf(callable, null);
  return callable;
};

const validateStringAccess = (val: string, sandboxOptions: ResolvedSandboxOptions, topLevel: boolean): void => {
  if (isBlockedAtScope(val, sandboxOptions, topLevel)) { throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ACCESS, val, sandboxOptions); }
  assertAllowed(val, sandboxOptions);
};

const handleSandboxDisabled = (obj: unknown, val: string | symbol, parentName: string | null): unknown => {
  if (!isNonNullish(obj)) { return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: val }; }
  return (obj as Record<string | symbol, unknown>)[val];
};

const handleSymbolAccess = (obj: unknown, val: symbol): unknown => {
  return (obj as Record<string | symbol, unknown> | undefined)?.[val];
};

const handlePropertyNotFound = (val: string | symbol, parentName: string | null): unknown => {
  return createPropertyNotFoundCallable(val, parentName);
};

const wrapMemberAccess = (obj: unknown, val: string | symbol, sandboxEnabled: boolean, options: SandboxOptions = {}, parentName: string | null = null): unknown => {
  const sandboxOptions = resolveSandboxOptions(options);
  const topLevel = options.topLevel ?? false;

  if (!sandboxEnabled) { return handleSandboxDisabled(obj, val, parentName); }
  if (typeof val === 'symbol') { return handleSymbolAccess(obj, val); }
  validateStringAccess(val, sandboxOptions, topLevel);
  if (!isNonNullish(obj)) { return { [NULL_MARKER]: true, [PARENT_NAME]: parentName, [ACCESS_PATH]: val }; }
  const target = obj as Record<string, unknown>;
  if (!hasOwn(target, val)) { return handlePropertyNotFound(val, parentName); }
  const value = target[val];
  if (isFunction(value)) { return wrapFunctionWithBlocking(value as (...args: unknown[]) => unknown, sandboxEnabled, val, sandboxOptions, target); }
  if (typeof value === 'object' && isNonNullish(value)) { return createSandboxedObject(value, sandboxEnabled, sandboxOptions); }
  return value;
};

export { resolveSandboxOptions, wrapFunctionWithBlocking, isAllowedKey, createSandboxedObject, createSandboxedContext, wrapMemberAccess };
export type { SandboxOptions, ResolvedSandboxOptions };
