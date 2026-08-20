import { getErrorMessage } from '@nunjucks/error-catalog';
import { extractAnsiErrorParts, formatFullAnsi, formatMediumAnsi } from './ansi/format-helpers.ts';
import { sanitizeTerminalText } from './ansi/sanitize-helpers.ts';
import { DEFAULT_IDE } from './presentation/ide-links/defaults.ts';
import { toDisplayLocation } from './presentation/source-trace/location.ts';
import type { SourceTrace } from './presentation/source-trace/source-trace.ts';

export type { AnsiOptions };
export { toAnsi };

/**
 * Options for ANSI rendering; `verbosity` defaults to `'full'` and `ide` falls back to
 * `DEFAULT_IDE` when omitted.
 */
interface AnsiOptions {
  verbosity?: 'simple' | 'medium' | 'full';
  templatePath?: string;
  lineno?: number | null;
  colno?: number | null;
  ide?: string;
  sourceTrace?: SourceTrace | null;
  renderContext?: Record<string, unknown>;
}

/**
 * Renders an error as a terminal-ready ANSI string. `'simple'` returns the bare message,
 * `'medium'` a one-liner with location and hints, and `'full'` the complete diagnostic with
 * source trace, render context, and stack; falsy errors render as `''`.
 */
const toAnsi = (error: unknown, options: AnsiOptions = {}): string => {
  if (!error) {
    return '';
  }

  const {
    verbosity = 'full',
    templatePath,
    lineno,
    colno,
    ide = DEFAULT_IDE,
    sourceTrace,
  } = options;
  // WHY: the message is user-controlled template text — strip terminal controls once
  // here (the single extraction point) so every verbosity path emits it sanitized
  // before the renderer wraps it in its own structured ANSI.
  const message = sanitizeTerminalText(getErrorMessage(error));

  if (verbosity === 'simple') {
    return message;
  }

  const parts = extractAnsiErrorParts({ error, templatePath, lineno, colno });

  if (verbosity === 'medium') {
    const location = toDisplayLocation({
      lineno: parts.displayLineno,
      colno: parts.displayColno,
      lineBase: parts.lineBase,
    });
    return formatMediumAnsi(message, {
      path: parts.path,
      location,
      causes: parts.causes,
      documentationUrl: parts.documentationUrl,
      ide,
    });
  }

  return formatFullAnsi(message, {
    parts,
    ide,
    sourceTrace,
    renderContext: options.renderContext,
    error,
  });
};
