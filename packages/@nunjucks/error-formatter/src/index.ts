// WHY: the root barrel stays renderer-free — `formatError` (the only presentation-coupled
// API) lives behind the `@nunjucks/error-formatter/format` subpath so domain packages
// importing `createLog` never load ANSI/HTML rendering code into their import closure.
export { createLog, isTemplateError, prettifyError } from './create-log/create-log.ts';
export type {
  TemplateError,
  TemplateWarning,
  ErrorContext,
  WarningContext,
  ErrorDefinitionEntry,
  RawLogData,
  IncludeChain,
} from './create-log/create-log.ts';
export { adjustColnoForNullValue } from './create-log/adjust-colno.ts';
export type {
  SourceFileReader,
  ProjectSourceLocation,
  ProjectSourceContent,
} from './create-log/create-log-types.ts';
export { normalizeErrorMetadata } from './normalize.ts';
