// WHY: shell placement — the console is a physical I/O sink; keeping the fallback log
// write here leaves pipe-stream free of console side-effects (mirrors the sanctioned
// runtime/src/shell/warning-emitter.ts seam). Domain code imports this module one-way.
import type { TemplateError } from '@nunjucks/error-formatter';
import { formatError } from '@nunjucks/error-formatter/format';

interface WriteErrorLogInput {
  error: TemplateError;
  dev: boolean;
}

/**
 * Fallback dev-log sink: renders an already-redacted `TemplateError` as ANSI to the
 * console. Pure formatting stays with the caller; this module owns only the physical
 * console write.
 */
export const writeErrorLog = ({ error, dev }: WriteErrorLogInput): void => {
  // biome-ignore lint/suspicious/noConsole: intentional server-side ANSI error logging for dev debugging
  console.log(formatError(error, { format: 'ansi', dev }));
};
