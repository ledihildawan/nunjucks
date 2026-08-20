// WHY: the root barrel stays renderer-free — `formatError` (the only presentation-coupled
// API) lives behind the `@nunjucks/error-formatter/format` subpath so domain packages
// importing `createLog` never load ANSI/HTML rendering code into their import closure.

export { adjustColnoForNullValue } from './create-log/adjust-colno.ts';
export type {
  ErrorContext,
  ErrorDefinitionEntry,
  IncludeChain,
  RawLogData,
  TemplateError,
  TemplateWarning,
  WarningContext,
} from './create-log/create-log.ts';
export { createLog, isTemplateError, prettifyError } from './create-log/create-log.ts';
export type {
  ProjectSourceContent,
  ProjectSourceLocation,
  SourceFileReader,
} from './create-log/create-log-types.ts';
export { normalizeErrorMetadata } from './normalize.ts';
