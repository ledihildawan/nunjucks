import { createLog, normalizeErrorMetadata, type TemplateError } from '@nunjucks/error-formatter';
import { resolveLocation, type LocationInputs, type CallerLocation } from './error-location.ts';
import { MATCH_ANY_RE } from '@nunjucks/lib';
import { isKeyedObject } from '@nunjucks/lib';
import type { Phase } from '@nunjucks/shared';
import { DEFAULT_IDE } from '@nunjucks/error-renderer';
import type { LineBase } from '@nunjucks/error-catalog';

interface DiagnosticsConfig {
  phase?: Phase | null;
  templatePath?: string | null;
  jsCaller?: string | null;
  jsCallerErrorLine?: number | null;
  jsCallerErrorCol?: number | null;
  callerFile?: string | null;
  callerLocation?: { fileName: string; lineNumber?: number | null; columnNumber?: number | null } | null;
  callerFrames?: readonly CallerLocation[] | null;
  dev?: boolean;
  ide?: string;
  lineno?: number | null;
  colno?: number | null;
  blockedContextKeys?: readonly string[] | null;
}

interface DiagnosticsBuildInput {
  metadata: ReturnType<typeof normalizeErrorMetadata>;
  templatePath: string | null;
  sourceContent: string | null;
  sourceStartLine: number;
  renderContext: Record<string, unknown> | null;
  preferCallerLocation: boolean;
  dev: boolean | null;
  ide: string | null;
  timestamp: string | null;
  environment: string | null;
}

export { findContextKeyPosition } from './find-context-key-position.ts';
export { readProjectSource } from './project-source-reader.ts';

const readStringProp = (value: unknown, key: string): string | undefined => {
  if (!isKeyedObject(value)) { return undefined; }
  const stringValue = value[key];
  return typeof stringValue === 'string' ? stringValue : undefined;
};

const extractErrorSnapshot = (err: unknown): Record<string, unknown> => {
  if (!isKeyedObject(err)) { return {}; }
  const { lineBase, lineno, colno, ...rest } = err;
  const name = readStringProp(err, 'name');
  const message = readStringProp(err, 'message');
  return { ...rest, ...(name !== undefined && { name }), ...(message !== undefined && { message }) };
};

const resolveErrorProps = (err: unknown): {
  resolvedCauses: string[] | undefined;
  resolvedFixCode: string | undefined;
  resolvedFixComment: string | undefined;
  resolvedSuggestion: string | undefined;
  resolvedDocumentationUrl: string | undefined;
  originalSeverity: 'error' | 'warning' | 'info' | undefined;
} => {
  const record = isKeyedObject(err) ? err : null;
  const causes = record?.causes;
  const fixCode = record?.fixCode;
  const fixComment = record?.fixComment;
  const suggestion = record?.suggestion;
  const documentationUrl = record?.documentationUrl;
  const severity = record?.severity;
  return {
    resolvedCauses: Array.isArray(causes) && causes.length > 0 ? causes : undefined,
    resolvedFixCode: typeof fixCode === 'string' ? fixCode : undefined,
    resolvedFixComment: typeof fixComment === 'string' ? fixComment : undefined,
    resolvedSuggestion: typeof suggestion === 'string' ? suggestion : undefined,
    resolvedDocumentationUrl: typeof documentationUrl === 'string' ? documentationUrl : undefined,
    originalSeverity: severity === 'error' || severity === 'warning' || severity === 'info' ? severity : undefined,
  };
};

const buildErrorDef = (metadata: ReturnType<typeof normalizeErrorMetadata>, resolved: ReturnType<typeof resolveErrorProps>) => ({
  name: metadata.code ?? 'RENDER_ERROR',
  message: () => metadata.message,
  pattern: MATCH_ANY_RE,
  causes: resolved.resolvedCauses,
  fixCode: resolved.resolvedFixCode,
  fixComment: resolved.resolvedFixComment,
  suggestion: resolved.resolvedSuggestion,
  documentationUrl: resolved.resolvedDocumentationUrl,
  severity: resolved.originalSeverity ?? 'error',
});

const buildContextObj = (input: DiagnosticsBuildInput): Record<string, unknown> => ({
  lineno: input.metadata.lineno,
  colno: input.metadata.colno,
  phase: input.metadata.phase,
  templateName: input.preferCallerLocation ? input.templatePath ?? input.metadata.templateName : input.metadata.templateName,
  lineBase: input.metadata.lineBase,
  dev: input.dev,
  ide: input.ide,
  templatePath: input.templatePath ?? undefined,
  sourceContent: input.sourceContent ?? undefined,
  sourceStartLine: input.sourceStartLine,
  renderContext: input.renderContext ?? undefined,
  timestamp: input.timestamp,
  environment: input.environment,
  verbosity: 'full',
  isJsCaller: input.preferCallerLocation,
});

interface MetadataInput {
  lineno: number | null;
  colno: number | null;
  lineBase: LineBase;
  phase: Phase;
  templatePath: string | null;
  sourceContent: string | null;
  sourceStartLine: number;
  renderContext: unknown;
}

const buildMetadata = (
  errSnapshot: Record<string, unknown>,
  input: MetadataInput
) => normalizeErrorMetadata(errSnapshot, {
  lineno: input.lineno,
  colno: input.colno,
  lineBase: input.lineBase,
  phase: input.phase,
  templateName: input.templatePath,
  templatePath: input.templatePath,
  sourceContent: input.sourceContent,
  sourceStartLine: input.sourceStartLine,
  renderContext: input.renderContext as Record<string, unknown> | null,
  code: typeof errSnapshot.code === 'string' ? errSnapshot.code : 'RENDER_ERROR'
});

interface ErrorObjectInput {
  resolvedProps: ReturnType<typeof resolveErrorProps>;
  contextObj: ReturnType<typeof buildContextObj>;
  templatePath: string | null;
  sourceStartLine: number;
  blockedKeys?: readonly string[] | null;
}

const createErrorObject = (
  metadata: ReturnType<typeof normalizeErrorMetadata>,
  input: ErrorObjectInput
): TemplateError => {
  const errorDef = buildErrorDef(metadata, input.resolvedProps);
  const errorObj = createLog('error', { def: errorDef, params: {}, subject: metadata.subject, context: input.contextObj });
  return Object.assign(errorObj, {
    templatePath: input.templatePath,
    sourceStartLine: input.sourceStartLine,
    renderContext: metadata.renderContext ?? undefined,
    ...(input.blockedKeys && input.blockedKeys.length > 0 ? { blockedKeys: input.blockedKeys } : {}),
  });
};

const resolveEffectiveBlockedKeys = (err: unknown, config: DiagnosticsConfig): readonly string[] | null => {
  const errRecord = isKeyedObject(err) ? err : null;
  const incoming = errRecord?.blockedKeys;
  if (Array.isArray(incoming) && incoming.length > 0) { return incoming as readonly string[]; }
  return config.blockedContextKeys ?? null;
};

interface LocationInputsBuild {
  config: DiagnosticsConfig;
  template: string | null;
  metadata: ReturnType<typeof normalizeErrorMetadata>;
}

const buildLocationInputs = ({ config, template, metadata }: LocationInputsBuild): LocationInputs => ({
  template,
  templatePath: config.templatePath ?? null,
  jsCaller: config.jsCaller ?? null,
  jsCallerErrorLine: config.jsCallerErrorLine ?? null,
  jsCallerErrorCol: config.jsCallerErrorCol ?? null,
  callerFile: config.callerFile ?? null,
  callerLocation: config.callerLocation ?? null,
  callerFrames: config.callerFrames ?? null,
  errLineno: metadata.lineno,
  errColno: metadata.colno,
  errLineBase: metadata.lineBase,
  lineno: config.lineno ?? null,
  colno: config.colno ?? null,
  subject: metadata.subject
});

// WHY: wrapWithLog is the error-enrichment shell — the SECOND pass in a two-layer pipeline:
//
//   Layer 1 (runtime): handleError() normalizes the raw error, looks up the catalog
//     definition (causes, fixCode, fixComment), and creates a TemplateError. This error
//     has correct code/message/subject/lineno but NO source trace or caller-location data.
//
//   Layer 2 (diagnostics): wrapWithLog() receives the Layer-1 error and adds:
//     a) resolveLocation() — reads caller source files to map template offsets → file:line
//     b) resolveErrorProps() — preserves causes/fixCode from the Layer-1 error
//     c) createErrorObject() — re-creates the error with full metadata + location + timestamp
//
//   The double normalizeErrorMetadata() call is intentional: Layer 1 normalizes the RAW
//   error (may be a plain Error, TypeError, etc.), Layer 2 normalizes the ENRICHED
//   TemplateError (consistent shape). Both pass through the same field-extraction logic.
//
//   In streaming mode, streamError() sits between the layers: it calls handleError (Layer 1)
//   and catches the throw, returning a sentinel. formatStreamSentinel then calls wrapWithLog
//   (Layer 2) on the sentinel's error.
export const wrapWithLog = async (
  err: unknown,
  config: DiagnosticsConfig,
  { template = null, renderContext = null }: { template?: string | null; renderContext?: unknown } = {}
): Promise<TemplateError> => {
  const resolvedSourceContent = typeof template === 'string' ? template : null;
  const initialMetadata = normalizeErrorMetadata(err, {
    phase: config.phase ?? 'render',
    templatePath: config.templatePath ?? config.callerFile ?? null,
    sourceContent: resolvedSourceContent,
    renderContext: renderContext as Record<string, unknown> | null
  });

  const resolved = await resolveLocation(buildLocationInputs({ config, template, metadata: initialMetadata }));

  const { lineno, colno, lineBase, templatePath, sourceContent, sourceStartLine, preferCallerLocation } = resolved;
  const errSnapshot = extractErrorSnapshot(err);
  const phase = initialMetadata.phase ?? config.phase ?? 'render';
  const dev = config.dev ?? false;
  const ide = config.ide ?? DEFAULT_IDE;
  // WHY: wrapWithLog is the error-enrichment shell — resolveLocation() above performs I/O to map template offsets to caller file:line. The timestamp is consistent with that impure role; render-boundary callers don't need to thread it through.
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV ?? 'development';

  const metadata = buildMetadata(errSnapshot, { lineno, colno, lineBase, phase, templatePath, sourceContent, sourceStartLine, renderContext });
  const resolvedProps = resolveErrorProps(err);
  const contextObj = buildContextObj({
    metadata,
    templatePath,
    sourceContent,
    sourceStartLine,
    renderContext: renderContext as Record<string, unknown> | null,
    preferCallerLocation,
    dev: dev ?? null,
    ide,
    timestamp,
    environment,
  });

  const effectiveBlockedKeys = resolveEffectiveBlockedKeys(err, config);
  return createErrorObject(metadata, { resolvedProps, contextObj, templatePath, sourceStartLine, blockedKeys: effectiveBlockedKeys });
};