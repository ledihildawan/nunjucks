export {
  ENVIRONMENTS,
  isCodeExecutionPattern,
  getBlockedKeyCategory,
  isBlockedKey,
  isDangerousGlobal,
  BLOCKED_KEYS_LIST,
  DANGEROUS_GLOBALS_LIST,
  OBJECT_INTRINSICS,
  CODE_EXECUTION_KEYS,
} from './blocked-keys.ts';
export type { Environment } from './blocked-keys.ts';
export { isDangerousReference, findDangerousValues } from './context-security.ts';
export { scanTemplateForDangerousCode } from './template-security.ts';
export type { DangerousCodeViolation } from './template-security.ts';
export { scrubDangerousReferences, visitAndScrub } from './scrubber.ts';
