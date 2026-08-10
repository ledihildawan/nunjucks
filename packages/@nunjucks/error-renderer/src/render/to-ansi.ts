import type { SourceTrace } from './internal/location/source-trace.ts';
import { toDisplayLocation } from './internal/location/location.ts';
import { extractAnsiErrorParts, formatMediumAnsi, formatFullAnsi, getErrorMessage } from './ansi/format-helpers';
import { DEFAULT_IDE } from './internal/config/defaults.ts';

export { toAnsi };
export type { AnsiOptions };

interface AnsiOptions {
  verbosity?: 'simple' | 'medium' | 'full';
  templatePath?: string;
  lineno?: number | null;
  colno?: number | null;
  ide?: string;
  sourceTrace?: SourceTrace | null;
  renderContext?: Record<string, unknown>;
}

const toAnsi = (error: unknown, options: AnsiOptions = {}): string => {
  if (!error) { return ''; }

  const { verbosity = 'full', templatePath, lineno, colno, ide = DEFAULT_IDE, sourceTrace } = options;
  const message = getErrorMessage(error);

  if (verbosity === 'simple') {
    return message;
  }

  const parts = extractAnsiErrorParts({ error, templatePath, lineno, colno });

  if (verbosity === 'medium') {
    const location = toDisplayLocation({ lineno: parts.displayLineno, colno: parts.displayColno, lineBase: parts.lineBase });
    return formatMediumAnsi(message, { path: parts.path, location, causes: parts.causes, documentationUrl: parts.documentationUrl, ide });
  }

  return formatFullAnsi(message, { parts, ide, sourceTrace, renderContext: options.renderContext, error });
};
