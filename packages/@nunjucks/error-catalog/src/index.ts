export type { BrandedTemplateError } from './branding.ts';
export { isTemplateError, TEMPLATE_ERROR } from './branding.ts';
export type {
  Classification,
  ErrorDefinition,
  ErrorSeverity,
  SecurityError,
} from './errors/index.ts';
export {
  classifyFromError,
  ERROR_DEFINITIONS,
  getError,
} from './errors/index.ts';
export type { LineBase } from './line-base.ts';
export { normalizeLineBase } from './line-base.ts';
export type { ErrorLike, Warning } from './types.ts';
export { isObjectValue } from './types.ts';
