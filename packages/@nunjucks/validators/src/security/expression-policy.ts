import { CODE_EXECUTION_KEYS, OBJECT_INTRINSICS } from '@nunjucks/shared';

/** Error codes emitted by expression validation, one per violation flavor. */
export const ExpressionSecurityError = {
  DYNAMIC_PROPERTY_ACCESS: 'DYNAMIC_PROPERTY_ACCESS',
  DANGEROUS_BRACKET_ACCESS: 'DANGEROUS_BRACKET_ACCESS',
  UNSAFE_PROPERTY: 'UNSAFE_PROPERTY',
} as const;

// WHY: blockedPropertyPatterns is the only policy knob validateExpression consumes —
// the three allow* toggles this config previously declared were never read by any
// code path (their "allows X" tests passed vacuously) and were purged (YAGNI).
export const DEFAULT_SECURITY_CONFIG = {
  blockedPropertyPatterns: [/^__/, /constructor$/, /prototype$/],
} as const;

/** Policy input for expression validation: regexes blocking property names. */
export type ExpressionSecurityConfig = {
  blockedPropertyPatterns?: readonly RegExp[];
};

/** Object intrinsics (`__proto__`, `constructor`, ...) blocked from any access. */
export const DANGEROUS_PROPERTIES: ReadonlySet<string> = new Set(OBJECT_INTRINSICS);

/** Callee names (`eval`, `Function`) blocked from call positions. */
export const DANGEROUS_CALLEES: ReadonlySet<string> = new Set(CODE_EXECUTION_KEYS);
