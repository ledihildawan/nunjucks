import type { SourceTrace } from './internal/source-trace.ts';
import { toDisplayLocation } from './internal/location.ts';
import { extractAnsiErrorParts, formatMediumAnsi, formatFullAnsi, getErrorMessage } from './ansi/format-helpers';

export { toAnsi };
export type { AnsiOptions } from './ansi/format-helpers';

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

  const { verbosity = 'full', templatePath, lineno, colno, ide = 'vscode', sourceTrace } = options;
  const message = getErrorMessage(error);

  if (verbosity === 'simple') {
    return message;
  }

  const parts = extractAnsiErrorParts(error, templatePath, lineno, colno);

  if (verbosity === 'medium') {
    const location = toDisplayLocation(parts.displayLineno, parts.displayColno, parts.lineBase);
    return formatMediumAnsi(message, parts.path, location, parts.causes, parts.documentationUrl, ide);
  }

  return formatFullAnsi(message, parts, ide, sourceTrace, options.renderContext);
};
