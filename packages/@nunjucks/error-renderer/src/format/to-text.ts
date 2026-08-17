import type { ErrorSeverity } from '@nunjucks/error-catalog';
import { getErrorMessage } from '@nunjucks/error-catalog';
import { slice, stripInlineMarkdown } from '@nunjucks/lib';
import { filter, join, map, pipe, split } from 'remeda';
import { mergeErrorParts } from './presentation/error/error-parts.ts';
import { toDisplayLocation } from './presentation/source-trace/location.ts';
import { shortenPath } from './presentation/source-trace/path-shortener.ts';
import { parseStackFrame } from './presentation/source-trace/stack-parse.ts';

/**
 * Options for plain-text rendering; the stack is a dev diagnostic and is omitted unless
 * `dev` is true or `isProduction` is explicitly false.
 */
interface ToTextOptions {
  verbosity?: 'simple' | 'medium' | 'full';
  templatePath?: string;
  lineno?: number | null;
  colno?: number | null;
  // WHY: safe-by-default — internal stack frames (absolute paths, host internals) are dev
  // diagnostics; they must not reach production clients just because a caller forgot a flag.
  dev?: boolean;
  isProduction?: boolean;
}

const getSeverityLabel = (severity: ErrorSeverity | undefined): string => {
  if (severity === 'warning') {
    return 'Warning:';
  }
  if (severity === 'info') {
    return 'Info:';
  }
  return 'Error:';
};

const formatStackLine = (line: string): string => {
  const frame = parseStackFrame(line);
  if (frame.path && frame.line !== null) {
    const shortPath = shortenPath(frame.path, '');
    if (frame.fn) {
      return `  at ${frame.fn} (${shortPath}:${frame.line})`;
    }
    return `  at ${shortPath}:${frame.line}`;
  }
  return `  ${frame.raw}`;
};

interface ErrorRecord {
  templateName?: string;
  lineno?: number | null;
  colno?: number | null;
  lineBase?: 'zero' | 'one';
  severity?: ErrorSeverity;
  stack?: string;
}

const isErrorRecord = (value: unknown): value is ErrorRecord =>
  typeof value === 'object' && value !== null;

interface MediumTextInput {
  severityLabel: string;
  error: unknown;
  templatePath: string | undefined;
  lineno: number | null | undefined;
  colno: number | null | undefined;
  causes: string[];
  documentationUrl: string | null;
}

const formatMediumText = (message: string, input: MediumTextInput): string => {
  const err = isErrorRecord(input.error) ? input.error : {};
  const path = input.templatePath ?? err.templateName ?? 'unknown';
  const location = toDisplayLocation({
    lineno: input.lineno ?? err.lineno ?? null,
    colno: input.colno ?? err.colno ?? null,
    lineBase: err.lineBase ?? 'zero',
  });
  const shortPath = shortenPath(path, '');
  const locationStr = ` at ${shortPath}:${location.line}:${location.col}`;
  const causeHint = input.causes.length > 0 ? stripInlineMarkdown(input.causes[0] ?? '') : '';
  const docHint = input.documentationUrl ?? '';
  const extras = pipe([causeHint, docHint], filter(Boolean), join(' | '));
  const extrasPart = extras ? `\n${extras}` : '';
  return `${input.severityLabel} ${message}${locationStr}${extrasPart}`;
};

interface ErrorParts {
  causes: string[];
  fixCode: string;
  fixComment: string;
  documentationUrl: string | null;
  severity: ErrorSeverity | undefined;
}

const extractErrorParts = (error: unknown): ErrorParts => {
  const parts = mergeErrorParts(error);
  const severity = isErrorRecord(error) ? error.severity : undefined;
  return { ...parts, severity };
};

const formatCauses = (causes: string[]): string[] => {
  if (causes.length === 0) {
    return [];
  }
  return ['', 'Possible Causes:', ...causes.map((c) => `  • ${stripInlineMarkdown(c)}`)];
};

interface FormatFixInput {
  fixCode: string;
  fixComment: string;
  documentationUrl: string | null;
}

const formatFix = ({ fixCode, fixComment, documentationUrl }: FormatFixInput): string[] => {
  if (!fixCode) {
    return [];
  }
  return [
    '',
    'Suggested Fix:',
    ...(fixComment ? [`  // ${stripInlineMarkdown(fixComment)}`] : []),
    `  ${fixCode}`,
    ...(documentationUrl ? [`  Learn more: ${documentationUrl}`] : []),
  ];
};

const formatStack = (error: unknown): string => {
  const stack = isErrorRecord(error) ? (error.stack ?? '') : '';
  return pipe(stack, split('\n'), slice(1), map(formatStackLine), join('\n'));
};

/**
 * Renders an error as plain text with no ANSI codes. `'simple'` returns the bare message,
 * `'medium'` a one-liner with location and first hint, and `'full'` adds causes, suggested
 * fix, and (outside production) the stack; falsy errors render as `''`.
 */
const toText = (error: unknown, options: ToTextOptions = {}): string => {
  if (!error) {
    return '';
  }

  const { verbosity = 'full', templatePath, lineno, colno } = options;
  const message = getErrorMessage(error);
  const isProduction = options.isProduction ?? !(options.dev ?? false);

  if (verbosity === 'simple') {
    return message;
  }

  const { causes, fixCode, fixComment, documentationUrl, severity } = extractErrorParts(error);
  const severityLabel = getSeverityLabel(severity);

  if (verbosity === 'medium' && (templatePath || lineno !== undefined || colno !== undefined)) {
    return formatMediumText(message, {
      severityLabel,
      error,
      templatePath,
      lineno,
      colno,
      causes,
      documentationUrl,
    });
  }

  const formattedStack = isProduction ? '' : formatStack(error);
  const parts: string[] = [
    `${severityLabel} ${message}`,
    ...formatCauses(causes),
    ...formatFix({ fixCode, fixComment, documentationUrl }),
    ...(formattedStack ? ['', formattedStack] : []),
  ];

  return pipe(parts, filter(Boolean), join('\n'));
};

export type { ToTextOptions };
export { toText };
