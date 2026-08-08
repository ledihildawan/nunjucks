import { createLog, type ErrorDefinitionEntry } from '@nunjucks/log';
import type { Phase } from '@nunjucks/shared';

interface LogContextShape {
  templateName: string | null;
  phase: Phase;
  renderContext: Record<string, unknown> | null;
}

const hasLogContext = (self: unknown): self is { logContext: LogContextShape } =>
  self != null && typeof self === 'object' && 'logContext' in self;

export const getLogContext = (self: unknown): LogContextShape => {
  if (hasLogContext(self)) {
    return self.logContext;
  }
  return { templateName: null, phase: 'render', renderContext: null };
};

interface ThrowRuntimeErrorOptions {
  self: unknown;
  lineno?: number | null;
  colno?: number | null;
  params?: Record<string, string>;
  subject?: string | null;
  templateName?: string | null;
}

export const throwRuntimeError = (
  def: ErrorDefinitionEntry,
  { self, lineno, colno, params, subject, templateName }: ThrowRuntimeErrorOptions,
): never => {
  const ctx = getLogContext(self);
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
