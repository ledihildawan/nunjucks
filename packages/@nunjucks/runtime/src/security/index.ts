export { createSecurityError, isSecurityError, isTemplateError } from './error.ts';
export type { SecurityError } from './error.ts';
export { scrubDangerousReferences, visitAndScrub } from './scrubber.ts';
export {
  validateContextKeys,
  validateContext,
  restrictGlobals,
  createSecurityValidator,
} from './validator.ts';
export type {
  ValidateContextOptions,
  CreateSecurityValidatorOptions,
  SecurityValidator,
  BlockedKeyResult,
  ValidateContextKeysResult,
} from './validator.ts';
export { findDangerousValues, scanTemplateForDangerousCode, isDangerousReference } from '@nunjucks/shared';
export type { DangerousCodeViolation } from '@nunjucks/shared';
