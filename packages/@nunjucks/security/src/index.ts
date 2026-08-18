export type { BlockedKeyCategory } from './blocked-key-policy.ts';
export {
  getBlockedKeyCategory,
  isBlockedKey,
  isCodeExecutionPattern,
  isDangerousGlobal,
  isPrototypeEscapeKey,
} from './blocked-key-policy.ts';
export { isDangerousReference } from './dangerous-reference.ts';
