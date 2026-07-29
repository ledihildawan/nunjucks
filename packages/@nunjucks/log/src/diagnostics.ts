// Import from the defining modules, not from '@nunjucks/log': this file is
// itself re-exported by that entry point, so going through it is a cycle.
import { createLog, type TemplateError } from './create-log.ts';
import { normalizeErrorMetadata } from './render/internal/normalize.ts';
import { resolveLocation } from '@nunjucks/shared/error-location';
import { MATCH_ANY_RE } from '@nunjucks/shared';

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
}

interface ErrorWithCauses extends Error {
  causes?: string[];
  fixCode?: string;
  fixComment?: string;
  suggestion?: string;
  documentationUrl?: string;
  severity?: 'error' | 'warning' | 'info';
}

export { findContextKeyPosition } from './find-context-key-position.ts';

const extractErrorSnapshot = (err: unknown): Record<string, unknown> => {
  const {
    lineBase: _droppedLineBase,
    lineno: _droppedLineno,
    colno: _droppedColno,
    ...errSnapshot
  } = err as Record<string, unknown>;
  Object.assign(errSnapshot, { name: (err as Error).name, message: (err as Error).message });
  return errSnapshot;
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
  name: metadata.code || 'RENDER_ERROR',
  message: () => metadata.message,
  pattern: MATCH_ANY_RE,
  causes: resolved.resolvedCauses,
  fixCode: resolved.resolvedFixCode,
  fixComment: resolved.resolvedFixComment,
  suggestion: resolved.resolvedSuggestion,
  documentationUrl: resolved.resolvedDocumentationUrl,
  severity: resolved.originalSeverity || 'error',
});

const buildContextObj = (
  metadata: ReturnType<typeof normalizeErrorMetadata>,
  templatePath: string | null,
  sourceContent: string | null,
  sourceStartLine: number,
  renderContext: unknown,
  preferCallerLocation: boolean,
  dev: boolean,
  ide: string,
  timestamp: string
): Record<string, unknown> => ({
  lineno: metadata.lineno,
  colno: metadata.colno,
  phase: metadata.phase,
  templateName: preferCallerLocation ? templatePath ?? metadata.templateName : metadata.templateName,
  lineBase: metadata.lineBase,
  dev,
  ide,
  templatePath: templatePath ?? undefined,
  sourceContent: sourceContent ?? undefined,
  sourceStartLine,
  renderContext: renderContext as Record<string, unknown> | undefined,
  timestamp,
  verbosity: 'full',
  isJsCaller: preferCallerLocation,
});

const buildMetadata = (
  errSnapshot: Record<string, unknown>,
  lineno: number | null,
  colno: number | null,
  lineBase: 'zero' | 'one',
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
  sourceStartLine: number
): TemplateError => {
  const errorDef = buildErrorDef(metadata, resolvedProps);
  const errorObj = createLog('error', errorDef, {}, metadata.subject, contextObj as Parameters<typeof createLog>[4]) as TemplateError;
  errorObj.templatePath = templatePath;
  errorObj.sourceStartLine = sourceStartLine;
  errorObj.renderContext = metadata.renderContext ?? undefined;
  return errorObj;
};

const resolveErrorMetadata = async (
  config: DiagnosticsConfig,
  template: string | null,
  initialMetadata: ReturnType<typeof normalizeErrorMetadata>
) => {
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
  return resolved;
};

export const wrapWithLog = async (err: unknown, config: DiagnosticsConfig, template: string | null = null, renderContext: unknown = null): Promise<TemplateError> => {
  const resolvedSourceContent = typeof template === 'string' ? template : null;
  const initialMetadata = normalizeErrorMetadata(err, {
    phase: config.phase || 'render',
    templatePath: config.templatePath || config._callerFile || null,
    sourceContent: resolvedSourceContent,
    renderContext: renderContext as Record<string, unknown> | null
  });

  const resolved = await resolveErrorMetadata(config, template, initialMetadata);

  const { lineno, colno, lineBase, templatePath, sourceContent, sourceStartLine, preferCallerLocation } = resolved;
  const errSnapshot = extractErrorSnapshot(err);
  const phase = initialMetadata.phase || config.phase || 'render';
  const dev = config.dev ?? false;
  const ide = config.ide ?? 'vscode';
  const timestamp = new Date().toISOString();

  const metadata = buildMetadata(errSnapshot, lineno, colno, lineBase, phase, templatePath, sourceContent, sourceStartLine, renderContext);
  const resolvedProps = resolveErrorProps(err);
  const contextObj = buildContextObj(metadata, templatePath, sourceContent, sourceStartLine, renderContext, preferCallerLocation, dev, ide, timestamp);

  return createErrorObject(metadata, resolvedProps, contextObj, templatePath, sourceStartLine);
};