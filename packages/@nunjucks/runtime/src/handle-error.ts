import { createLog, normalizeErrorMetadata, ERROR_DEFINITIONS, type ErrorContext } from '@nunjucks/log';
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

  // WHY: merge the full catalog definition (causes, fixCode, fixComment, severity) with the resolved message. Inline def was used before, which meant error markers and pages showed no causes/fix. Also replace {subject} placeholders in causes/fixCode/fixComment so the rendered text is concrete, not template literals.
  const errorCode = metadata.code ?? 'RUNTIME_ERROR';
  const subjectStr = metadata.subject ?? '';
  const catalogDef = errorCode && Object.hasOwn(ERROR_DEFINITIONS, errorCode)
    ? ERROR_DEFINITIONS[errorCode as keyof typeof ERROR_DEFINITIONS]
    : undefined;

  const thrown = createLog('error', {
    def: catalogDef
      ? {
          ...catalogDef,
          message: () => metadata.message,
          causes: catalogDef.causes?.map(c => c.replaceAll('{subject}', subjectStr)),
          fixCode: catalogDef.fixCode?.replaceAll('{subject}', subjectStr),
          fixComment: catalogDef.fixComment?.replaceAll('{subject}', subjectStr),
        }
      : {
          name: errorCode,
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
