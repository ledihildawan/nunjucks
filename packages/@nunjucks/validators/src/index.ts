// WHY: curated barrel — every public name is listed explicitly so a new module export
// cannot silently widen @nunjucks/validators' API surface; adding a name requires an edit here.

export { validateConfig } from './config.ts';
export { findContextDangerousValues, validateRenderContext } from './context.ts';
export { validateExpression } from './expression.ts';
export { getReservedKeywords, RESERVED_KEYWORDS } from './reserved.ts';
export type { DangerousCodeViolation } from './security/index.ts';
export {
  DANGEROUS_CALLEES,
  DANGEROUS_PROPERTIES,
  DEFAULT_SECURITY_CONFIG,
  type ExpressionSecurityConfig,
  ExpressionSecurityError,
  scrubDangerousReferences,
} from './security/index.ts';
export { validateTemplate } from './template.ts';
