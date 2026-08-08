import { createLog, normalizeErrorMetadata, type ErrorContext } from '@nunjucks/log';
import { MATCH_ANY_RE } from '@nunjucks/shared';
import {
  getLogContext,
} from './log-context.ts';

interface ErrorWithLineInfo extends Error {
  lineno?: number | null;
}

const isErrorWithLineInfo = (value: unknown): value is ErrorWithLineInfo =>
  value instanceof Error;

interface HandleErrorLocation {
  lineno: number | null;
  colno: number | null;
}

// WHY: handleError is the single re-throw funnel for errors raised by compiled template code; it is wired into generated code and must propagate via throw to the imperative-shell boundary that owns error reporting.
function handleError(this: unknown, error: unknown, { lineno, colno }: HandleErrorLocation): never {
  const ctx = getLogContext(this);
  const metadata = normalizeErrorMetadata(error, {
    lineno,
    colno,
    phase: ctx.phase ?? 'render',
    templateName: ctx.templateName ?? 'inline',
    renderContext: ctx.renderContext ?? null,
    lineBase: 'zero',
  });

  if (metadata.lineno !== null && isErrorWithLineInfo(error)) {
    const errorLineno = error.lineno;
    if (errorLineno !== undefined && errorLineno !== null) {
      throw error;
    }
  }

  const thrown = createLog('error', {
    def: {
      name: metadata.code ?? 'RUNTIME_ERROR',
      message: () => metadata.message,
      pattern: MATCH_ANY_RE,
    },
    params: {},
    subject: metadata.subject,
    context: {
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
  });

  thrown.templatePath = metadata.templatePath;
  thrown.sourceStartLine = metadata.sourceStartLine;
  throw thrown;
}

export { handleError };
