// Data flow in packages/@nunjucks/log:
// producer error/warning -> createLog() -> normalizeLogMetadata() -> createFormatterState() -> formatter (html/ansi/text/console)
export { createLog } from './create-log.ts';
export { toHtml, CSS, PRODUCTION_BODY, TOGGLE_SCRIPT } from './error/to-html.ts';
export { toAnsi } from './error/to-ansi.ts';
export { toText } from './error/to-text.ts';
export { toConsoleString } from './error/to-console.ts';
export { classify } from './error/classify.ts';
export { injectWarningsScript } from './warning/collector.ts';
export { normalizeLogMetadata, createFormatterState } from './error/metadata.ts';
export { normalizeErrorMetadata } from './error/normalize.ts';
export { getErrorMetadata, formatSnippet } from './error/metadata-extras.ts';
export type { ErrorMetadata, GetErrorMetadataOptions } from './error/metadata-extras.ts';
export type { ErrorMetadataFallback, NormalizedErrorMetadata } from './error/normalize.ts';
export { ERROR_DEFINITIONS, ERRORS, PATTERNS } from './error/messages.ts';
export type { ErrorName } from './error/messages.ts';
