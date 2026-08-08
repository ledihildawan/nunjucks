import { createLog, type TemplateError } from './create-log/create-log.ts';
import { normalizeErrorMetadata } from './normalize.ts';
import { resolveLocation, MATCH_ANY_RE, isKeyedObject } from '@nunjucks/shared';
import { DEFAULT_IDE } from './render/internal/config/defaults.ts';
import type { LineBase } from './line-base.ts';

interface DiagnosticsConfig {
  phase?: string | null;
  templatePath?: string | null;
  jsCaller?: string | null;
  jsCallerErrorLine?: number | null;
  jsCallerErrorCol?: number | null;
  _callerFile?: string | null;
  _callerLocation?: { fileName: string; lineNumber?: number | null; columnNumber?: number | null } | null;
  dev?: boolean;
  ide?: string;
  lineno?: number | null;
  colno?: number | null;
  blockedContextKeys?: readonly string[] | null;
}

interface ErrorWithCauses extends Error {
  causes?: string[];
  fixCode?: string;
  fixComment?: string;
  suggestion?: string;
  documentationUrl?: string;
  severity?: 'error' | 'warning' | 'info';
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
}

export { findContextKeyPosition } from './find-context-key-position.ts';

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
  const errExt = err as ErrorWithCauses;
  return {
    resolvedCauses: Array.isArray(errExt.causes) && errExt.causes.length > 0 ? errExt.causes : undefined,
    resolvedFixCode: typeof errExt.fixCode === 'string' ? errExt.fixCode : undefined,
    resolvedFixComment: typeof errExt.fixComment === 'string' ? errExt.fixComment : undefined,
    resolvedSuggestion: typeof errExt.suggestion === 'string' ? errExt.suggestion : undefined,
    resolvedDocumentationUrl: typeof errExt.documentationUrl === 'string' ? errExt.documentationUrl : undefined,
    originalSeverity: errExt.severity,
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
  verbosity: 'full',
  isJsCaller: input.preferCallerLocation,
});

const buildMetadata = (
  errSnapshot: Record<string, unknown>,
  lineno: number | null,
  colno: number | null,
  lineBase: LineBase,
  phase: string,
  templatePath: string | null,
  sourceContent: string | null,
  sourceStartLine: number,
  renderContext: unknown
) => normalizeErrorMetadata(errSnapshot, {
  lineno,
  colno,
  lineBase,
  phase,
  templateName: templatePath,
  templatePath,
  sourceContent,
  sourceStartLine,
  renderContext: renderContext as Record<string, unknown> | null,
  code: 'RENDER_ERROR'
});

const createErrorObject = (
  metadata: ReturnType<typeof normalizeErrorMetadata>,
  resolvedProps: ReturnType<typeof resolveErrorProps>,
  contextObj: ReturnType<typeof buildContextObj>,
  templatePath: string | null,
  sourceStartLine: number,
  blockedKeys?: readonly string[] | null
): TemplateError => {
  const errorDef = buildErrorDef(metadata, resolvedProps);
  const errorObj = createLog('error', errorDef, {}, metadata.subject, contextObj as Parameters<typeof createLog>[4]);
  return Object.assign(errorObj, {
    templatePath,
    sourceStartLine,
    renderContext: metadata.renderContext ?? undefined,
    ...(blockedKeys && blockedKeys.length > 0 ? { blockedKeys } : {}),
  });
};

const resolveEffectiveBlockedKeys = (err: unknown, config: DiagnosticsConfig): readonly string[] | null => {
  const errRecord = isKeyedObject(err) ? err : null;
  const incoming = errRecord?.blockedKeys;
  if (Array.isArray(incoming) && incoming.length > 0) { return incoming as readonly string[]; }
  return config.blockedContextKeys ?? null;
};

export const wrapWithLog = async (err: unknown, config: DiagnosticsConfig, template: string | null = null, renderContext: unknown = null): Promise<TemplateError> => {
  const resolvedSourceContent = typeof template === 'string' ? template : null;
  const initialMetadata = normalizeErrorMetadata(err, {
    phase: config.phase ?? 'render',
    templatePath: config.templatePath ?? config._callerFile ?? null,
    sourceContent: resolvedSourceContent,
    renderContext: renderContext as Record<string, unknown> | null
  });

  const resolved = await resolveLocation({
    template,
    templatePath: config.templatePath ?? null,
    jsCaller: config.jsCaller ?? null,
    jsCallerErrorLine: config.jsCallerErrorLine ?? null,
    jsCallerErrorCol: config.jsCallerErrorCol ?? null,
    _callerFile: config._callerFile ?? null,
    _callerLocation: config._callerLocation ?? null,
    errLineno: initialMetadata.lineno,
    errColno: initialMetadata.colno,
    errLineBase: initialMetadata.lineBase,
    lineno: config.lineno ?? null,
    colno: config.colno ?? null,
    subject: initialMetadata.subject
  });

  const { lineno, colno, lineBase, templatePath, sourceContent, sourceStartLine, preferCallerLocation } = resolved;
  const errSnapshot = extractErrorSnapshot(err);
  const phase = initialMetadata.phase ?? config.phase ?? 'render';
  const dev = config.dev ?? false;
  const ide = config.ide ?? DEFAULT_IDE;
  const timestamp = new Date().toISOString();

  const metadata = buildMetadata(errSnapshot, lineno, colno, lineBase, phase, templatePath, sourceContent, sourceStartLine, renderContext);
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
  });

  const effectiveBlockedKeys = resolveEffectiveBlockedKeys(err, config);
  return createErrorObject(metadata, resolvedProps, contextObj, templatePath, sourceStartLine, effectiveBlockedKeys);
};