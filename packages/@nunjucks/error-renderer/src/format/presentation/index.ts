export { getErrorMessage } from '@nunjucks/error-catalog/get-error-message';
export { stripInlineMarkdown } from '@nunjucks/lib/strip-inline-markdown';
export type { MergedErrorParts } from './error/error-parts.ts';
export { mergeErrorParts } from './error/error-parts.ts';
export type {
  FormatterState,
  FormatterStateInput,
  NormalizedLogMetadata,
} from './error/metadata.ts';
export { createFormatterState } from './error/metadata.ts';
export { normalizeRenderContext } from './error/safe-context.ts';
export { formatStackTraceHtml, renderContextHtml } from './error/sections.ts';
export { DEFAULT_IDE } from './ide-links/defaults.ts';
export { getIdeMeta, isFilePath, resolveIdeLink } from './ide-links/ide-links.ts';
export type { DisplayLocation } from './source-trace/location.ts';
export { formatLocationAnnotation, toDisplayLocation } from './source-trace/location.ts';
export { normalizeDrivePath, shortenPath } from './source-trace/path-shortener.ts';
export type {
  BuildSourceTraceInput,
  SourceTrace,
  SourceTraceCaret,
  SourceTraceLine,
} from './source-trace/source-trace.ts';
export { buildSourceTrace, windowSourceTrace } from './source-trace/source-trace.ts';
export type { ParsedStackFrame } from './source-trace/stack-parse.ts';
export { parseStackFrame } from './source-trace/stack-parse.ts';
export type { CaretResult } from './syntax-highlight/caret.ts';
export { calculateCaretPosition } from './syntax-highlight/caret.ts';
export { highlightHtml, highlightJs, renderInlineMarkdown } from './syntax-highlight/highlight.ts';
