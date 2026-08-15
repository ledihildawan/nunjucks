import type { WarningContext } from '@nunjucks/error-formatter';
import { createLog } from '@nunjucks/error-formatter';
import { MATCH_ANY_RE, readObject } from '@nunjucks/lib';
import type { HandledUndefinedMode, Phase } from '@nunjucks/shared';
import { WARNINGS_CONTEXT_KEY } from '@nunjucks/shared';

interface EmitUndefinedWarningOptions {
  name: string;
  message: () => string;
  subject: string | null;
  lineno?: number | null;
  colno?: number | null;
  phase: Phase;
  templateName: string;
  mode: HandledUndefinedMode;
  varName: string | null;
}

export const emitUndefinedWarning = (
  runtimeContext: unknown,
  options: EmitUndefinedWarningOptions
): void => {
  const warning = createLog('warning', {
    def: {
      name: options.name,
      message: options.message,
      pattern: MATCH_ANY_RE,
    },
    params: {},
    subject: options.subject,
    context: {
      lineno: options.lineno ?? null,
      colno: options.colno ?? null,
      phase: options.phase,
      templateName: options.templateName,
      undefinedMode: options.mode,
      varName: options.varName,
      lineBase: 'zero',
    } as WarningContext,
  });
  const collector = readObject(runtimeContext)[WARNINGS_CONTEXT_KEY];
  if (Array.isArray(collector)) {
    collector.push(warning);
  } else {
    // biome-ignore lint/suspicious/noConsole: documented fallback when no warning collector is attached to the render.
    console.warn(warning.message);
  }
};
