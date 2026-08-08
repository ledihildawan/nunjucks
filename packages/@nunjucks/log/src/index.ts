export { createLog, prettifyError } from './create-log/create-log.ts';
export type { TemplateError, TemplateWarning, ErrorContext, WarningContext, ErrorDefinitionEntry, IncludeChain } from './create-log/create-log.ts';
export { formatError } from './create-log/create-log-error.ts';
export { injectWarningsScript } from './warning/collector.ts';
export type { Warning } from './warning/collector.ts';
export { ERROR_DEFINITIONS, getError } from '@nunjucks/error-catalog';
export { normalizeErrorMetadata } from './normalize.ts';
export { findContextKeyPosition, wrapWithLog } from './diagnostics.ts';
