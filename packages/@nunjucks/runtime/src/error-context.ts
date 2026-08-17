import type { ErrorDefinitionEntry } from '@nunjucks/error-formatter';
import { createLog } from '@nunjucks/error-formatter';
import type { Phase } from '@nunjucks/shared';

interface LogContextShape {
  templateName: string | null;
  phase: Phase;
  renderContext: Record<string, unknown> | null;
}

const hasLogContext = (
  runtimeContext: unknown
): runtimeContext is { logContext: LogContextShape } =>
  runtimeContext != null &&
  typeof runtimeContext === 'object' &&
  'logContext' in runtimeContext &&
  // WHY: presence alone is not enough — a null logContext would pass an `in` check
  // and then crash every downstream property read, masking the original error.
  (runtimeContext as { logContext?: unknown }).logContext != null &&
  typeof (runtimeContext as { logContext?: unknown }).logContext === 'object';

export const getLogContext = (runtimeContext: unknown): LogContextShape => {
  if (hasLogContext(runtimeContext)) {
    return runtimeContext.logContext;
  }
  return { templateName: null, phase: 'render', renderContext: null };
};

interface ThrowRuntimeErrorOptions {
  runtimeContext: unknown;
  lineno?: number | null;
  colno?: number | null;
  params?: Record<string, string>;
  subject?: string | null;
  templateName?: string | null;
}

export const throwRuntimeError = (
  def: ErrorDefinitionEntry,
  { runtimeContext, lineno, colno, params, subject, templateName }: ThrowRuntimeErrorOptions
): never => {
  const ctx = getLogContext(runtimeContext);
  throw createLog('error', {
    def,
    params: params ?? {},
    subject: subject ?? null,
    context: {
      lineno: lineno ?? null,
      colno: colno ?? null,
      phase: ctx.phase ?? 'render',
      templateName: templateName ?? ctx.templateName ?? 'inline',
      lineBase: 'zero',
    },
  });
};

export type { LogContextShape };
