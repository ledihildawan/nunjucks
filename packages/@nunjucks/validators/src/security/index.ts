export {
  DANGEROUS_CALLEES,
  DANGEROUS_PROPERTIES,
  DEFAULT_SECURITY_CONFIG,
  type ExpressionSecurityConfig,
  ExpressionSecurityError,
} from './expression-policy.ts';
export { scrubDangerousReferences } from './scrubber.ts';
export type { DangerousCodeViolation } from './template-security.ts';
