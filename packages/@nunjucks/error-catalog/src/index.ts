export {
  ERROR_DEFINITIONS,
  getError,
  createErrorDefinition,
  firstCapture,
  RUNTIME_ERRORS,
  PARSER_ERRORS,
  SANDBOX_ERRORS,
  IO_ERRORS,
  FILTER_ERRORS,
  TEMPLATE_ERRORS,
  classifyFromError,
  createSecurityError,
  isSecurityError,
} from './errors/index.ts';
export type {
  ErrorDefinition,
  SubjectExtractor,
  ExtraExtractor,
  ErrorSeverity,
  Classification,
  ClassifyInput,
  Classifier,
  SecurityError,
} from './errors/index.ts';
export { TEMPLATE_ERROR, isTemplateError } from './branding.ts';
export type { BrandedTemplateError } from './branding.ts';
export type { LineBase } from './line-base.ts';
export { normalizeLineBase } from './line-base.ts';
export type { ErrorLike, Warning } from './types.ts';
export { isErrorLike } from './types.ts';
