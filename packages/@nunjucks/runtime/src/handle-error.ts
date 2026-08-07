import { createLog, normalizeErrorMetadata, type ErrorContext } from '@nunjucks/log';
import { MATCH_ANY_RE } from '@nunjucks/shared';
import {
  getLogContext,
} from './log-context.ts';

function handleError(this: unknown, error: unknown, lineno: number | null, colno: number | null): never {
  const ctx = getLogContext(this);
  const metadata = normalizeErrorMetadata(error, {
    lineno,
    colno,
    phase: ctx.phase || 'render',
    templateName: ctx.templateName || 'inline',
    renderContext: ctx.renderContext || null,
    lineBase: 'zero',
  });

  if (metadata.lineno !== null && error instanceof Error) {
    const errorLineno = (error as Error & { lineno?: number }).lineno;
    if (errorLineno !== undefined && errorLineno !== null) {
      throw error;
    }
  }

  const thrown = createLog(
    'error',
    {
      name: metadata.code || 'RUNTIME_ERROR',
      message: () => metadata.message,
      pattern: MATCH_ANY_RE,
    },
    {},
    metadata.subject,
    {
      lineno: metadata.lineno,
      colno: metadata.colno,
      phase: metadata.phase,
      templateName: metadata.templateName,
      templatePath: metadata.templatePath,
      sourceContent: metadata.sourceContent,
      sourceStartLine: metadata.sourceStartLine,
      renderContext: metadata.renderContext,
      lineBase: metadata.lineBase,
    } as ErrorContext,
  );

  thrown.templatePath = metadata.templatePath;
  thrown.sourceStartLine = metadata.sourceStartLine;
  throw thrown;
}

export { handleError };
