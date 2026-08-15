export type { SandboxedContextInput, WrapMemberAccessInput } from './sandbox.ts';
export { createSandboxedContext, wrapMemberAccess } from './sandbox.ts';
export type { ResolvedSandboxOptions, SandboxOptions } from './sandbox-options.ts';
export { resolveSandboxOptions } from './sandbox-options.ts';
export {
  DANGEROUS_OBJECT_INTRINSICS,
  isAllowedKey,
  isBlockedAtScope,
  isBlockedSymbol,
  isInternalKey,
} from './sandbox-predicates.ts';
export type { SandboxedValueInput } from './sandbox-traps.ts';
export { createSandboxedObject } from './sandbox-traps.ts';
