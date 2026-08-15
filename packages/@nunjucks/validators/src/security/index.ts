export type { Environment } from './blocked-keys.ts';
export {
  BLOCKED_KEYS_LIST,
  CODE_EXECUTION_KEYS,
  DANGEROUS_GLOBALS_LIST,
  ENVIRONMENTS,
  getBlockedKeyCategory,
  isBlockedKey,
  isCodeExecutionPattern,
  isDangerousGlobal,
  OBJECT_INTRINSICS,
} from './blocked-keys.ts';
export { DANGEROUS_KEY_PATTERN } from './dangerous-keys.ts';
export {
  DANGEROUS_CALLEES,
  DANGEROUS_PROPERTIES,
  DEFAULT_SECURITY_CONFIG,
  type ExpressionSecurityConfig,
  ExpressionSecurityError,
} from './expression-policy.ts';
export { scrubDangerousReferences } from './scrubber.ts';
export type { DangerousCodeViolation } from './template-security.ts';
