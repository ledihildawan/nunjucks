export { createLog, prettifyError, formatError, normalizeErrorMetadata, injectWarningsScript } from '@nunjucks/error-formatter';
export type { TemplateError, TemplateWarning, ErrorContext, WarningContext, ErrorDefinitionEntry, IncludeChain } from '@nunjucks/error-formatter';
export { ERROR_DEFINITIONS, getError } from '@nunjucks/error-catalog';
export type { Warning } from '@nunjucks/error-catalog';
export { findContextKeyPosition, wrapWithLog } from './diagnostics.ts';
