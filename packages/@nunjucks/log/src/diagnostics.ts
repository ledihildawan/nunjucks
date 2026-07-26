import { createLog, type TemplateError } from '@nunjucks/log';
import { normalizeErrorMetadata } from '@nunjucks/log';
import { resolveLocation } from '@nunjucks/shared/error-location';

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

export const wrapWithLog = async (err: unknown, config: DiagnosticsConfig, template: string | null = null, renderContext: unknown = null): Promise<TemplateError> => {
  let resolvedSourceContent: string | null = null;
  if (typeof template === 'string') {
    resolvedSourceContent = template;
  }
  const initialMetadata = normalizeErrorMetadata(err, {
    phase: config.phase || 'render',
    templatePath: config.templatePath || config._callerFile || null,
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

  // IMPORTANT: do NOT mutate `err` — copy fields off it before re-normalizing.
  const {
    lineBase: _droppedLineBase,
    lineno: _droppedLineno,
    colno: _droppedColno,
    ...errSnapshot
  } = err as Record<string, unknown>;
  Object.assign(errSnapshot, { name: (err as Error).name, message: (err as Error).message });

  const phase = initialMetadata.phase || config.phase || 'render';
  const dev = config.dev ?? false;
  const ide = config.ide ?? 'vscode';
  const timestamp = new Date().toISOString();

  const metadata = normalizeErrorMetadata(errSnapshot, {
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

  const errExt = err as ErrorWithCauses;
  const originalCauses = errExt.causes;
  const originalFixCode = errExt.fixCode;
  const originalFixComment = errExt.fixComment;
  const originalSuggestion = errExt.suggestion;
  const originalDocumentationUrl = errExt.documentationUrl;
  const originalSeverity = errExt.severity;

  let resolvedCauses: string[] | undefined;
  if (Array.isArray(originalCauses) && originalCauses.length > 0) {
    resolvedCauses = originalCauses;
  }
  let resolvedFixCode: string | undefined;
  if (typeof originalFixCode === 'string') {
    resolvedFixCode = originalFixCode;
  }
  let resolvedFixComment: string | undefined;
  if (typeof originalFixComment === 'string') {
    resolvedFixComment = originalFixComment;
  }
  let resolvedSuggestion: string | undefined;
  if (typeof originalSuggestion === 'string') {
    resolvedSuggestion = originalSuggestion;
  }
  let resolvedDocumentationUrl: string | undefined;
  if (typeof originalDocumentationUrl === 'string') {
    resolvedDocumentationUrl = originalDocumentationUrl;
  }
  const errorDef = {
    name: metadata.code || 'RENDER_ERROR',
    message: () => metadata.message,
    pattern: /./,
    causes: resolvedCauses,
    fixCode: resolvedFixCode,
    fixComment: resolvedFixComment,
    suggestion: resolvedSuggestion,
    documentationUrl: resolvedDocumentationUrl,
    severity: originalSeverity || 'error',
  };

  const contextObj: Record<string, unknown> = {
    lineno: metadata.lineno,
    colno: metadata.colno,
    phase: metadata.phase,
    templateName: metadata.templateName,
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
  };

  const errorObj = createLog('error', errorDef, {}, metadata.subject, contextObj as Parameters<typeof createLog>[4]) as TemplateError;
  errorObj.templatePath = templatePath;
  errorObj.sourceStartLine = sourceStartLine;
  errorObj.renderContext = metadata.renderContext ?? undefined;

  return errorObj;
};