export { resolveSandboxOptions, wrapFunctionWithBlocking, createSandboxedObject, createSandboxedContext, wrapMemberAccess } from './sandbox.ts';
export type { SandboxOptions, ResolvedSandboxOptions } from './sandbox.ts';
export { isBlockedKey, isDangerousGlobal, isCodeExecutionPattern, getBlockedKeyCategory, BLOCKED_KEYS_LIST, DANGEROUS_GLOBALS_LIST } from '@nunjucks/shared';
export { DANGEROUS_OBJECT_INTRINSICS, isBlockedSymbol, isAllowedKey, isBlockedAtScope, isInternalKey } from './sandbox-predicates.ts';
