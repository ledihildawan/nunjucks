import { createLog, normalizeErrorMetadata, type ErrorContext } from '@nunjucks/error-formatter';
import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { MATCH_ANY_RE } from '@nunjucks/lib';
import {
  getLogContext,
} from './error-context.ts';

// WHY: isErrorInstance narrows to Error. The lineno access at the call site uses optional chaining because Error doesn't guarantee lineno — only TemplateError (a subclass via Object.assign) has it. The type intersection `Error & { lineno?: ... }` documents this without claiming the field always exists.
const isErrorInstance = (value: unknown): value is Error =>
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

  // WHY: re-throw the original error if it already carries lineno — avoids double-enrichment. The outer metadata.lineno check is a cheap pre-filter (lineno may come from the call-site argument, not the error itself); the inner check verifies the error actually has lineno set.
  if (metadata.lineno !== null && isErrorInstance(error)) {
    const errorLineno = (error as { lineno?: number | null }).lineno;
    if (errorLineno !== undefined && errorLineno !== null) {
      throw error;
    }
  }

  // WHY: merge the full catalog definition (causes, fixCode, fixComment, severity) with the resolved message. {subject} placeholders are left intact here — classify.ts replaces them at render time (single source of truth for placeholder substitution).
  const errorCode = metadata.code ?? 'RUNTIME_ERROR';
  const catalogDef = errorCode && Object.hasOwn(ERROR_DEFINITIONS, errorCode)
    ? ERROR_DEFINITIONS[errorCode as keyof typeof ERROR_DEFINITIONS]
    : undefined;

  const thrown = createLog('error', {
    def: catalogDef
      ? { ...catalogDef, message: () => metadata.message }
      : { name: errorCode, message: () => metadata.message, pattern: MATCH_ANY_RE },
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
