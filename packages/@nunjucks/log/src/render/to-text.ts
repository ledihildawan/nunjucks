import { pipe, filter, join, map, split } from 'remeda';
import { shortenPath } from './internal/path-shortener.ts';
import { toDisplayLocation } from './internal/location.ts';
import { mergeErrorParts } from './internal/error-parts.ts';
import { parseStackFrame } from './internal/stack-parse.ts';
import { slice } from '@nunjucks/shared';
import { stripMarkdown } from './internal/markdown.ts';
import { getErrorMessage } from './internal/message.ts';
import type { ErrorLike } from '../types.ts';

interface ToTextOptions {
  verbosity?: 'simple' | 'medium' | 'full';
  templatePath?: string;
  lineno?: number | null;
  colno?: number | null;
}

const getSeverityLabel = (severity: 'error' | 'warning' | 'info' | undefined): string => {
  if (severity === 'warning') { return 'Warning:'; }
  if (severity === 'info') { return 'Info:'; }
  return 'Error:';
};

const formatStackLine = (line: string): string => {
  const frame = parseStackFrame(line);
  if (frame.path && frame.line !== null) {
    const shortPath = shortenPath(frame.path);
    if (frame.fn) {
      return `  at ${frame.fn} (${shortPath}:${frame.line})`;
    }
    return `  at ${shortPath}:${frame.line}`;
  }
  return `  ${frame.raw}`;
};

const formatMediumText = (
  message: string,
  severityLabel: string,
  error: unknown,
  templatePath: string | undefined,
  lineno: number | null | undefined,
  colno: number | null | undefined,
  causes: string[],
  documentationUrl: string | null
): string => {
  const err = error as ErrorLike;
  const path = templatePath || err.templateName || 'unknown';
  const location = toDisplayLocation(
    lineno ?? err.lineno ?? null,
    colno ?? err.colno ?? null,
    err.lineBase ?? 'zero'
  );
  const shortPath = shortenPath(path);
  const locationStr = ` at ${shortPath}:${location.line}:${location.col}`;
  const causeHint = causes.length > 0 ? stripMarkdown(causes[0] ?? '') : '';
  const docHint = documentationUrl || '';
  const extras = pipe([causeHint, docHint], filter(Boolean), join(' | '));
  const extrasPart = extras ? `\n${extras}` : '';
  return `${severityLabel} ${message}${locationStr}${extrasPart}`;
};

interface ErrorParts {
  causes: string[];
  fixCode: string;
  fixComment: string;
  documentationUrl: string | null;
  severity: 'error' | 'warning' | 'info' | undefined;
}

const extractErrorParts = (error: unknown): ErrorParts => {
  const parts = mergeErrorParts(error);
  const errObj = error as { severity?: 'error' | 'warning' | 'info' };
  return { ...parts, severity: errObj.severity };
};

const formatCauses = (causes: string[]): string[] => {
  if (causes.length === 0) { return []; }
  return ['', 'Possible Causes:', ...causes.map(c => `  • ${stripMarkdown(c)}`)];
};

const formatFix = (fixCode: string, fixComment: string, documentationUrl: string | null): string[] => {
  if (!fixCode) { return []; }
  return [
    '', 'Suggested Fix:',
    ...(fixComment ? [`  // ${stripMarkdown(fixComment)}`] : []),
    `  ${fixCode}`,
    ...(documentationUrl ? [`  Learn more: ${documentationUrl}`] : [])
  ];
};

const formatStack = (error: unknown): string => {
  const stack = (error as Error).stack || '';
  return pipe(stack, split('\n'), slice(1), map(formatStackLine), join('\n'));
};

const toText = (error: unknown, options: ToTextOptions = {}): string => {
  if (!error) { return ''; }

  const { verbosity = 'full', templatePath, lineno, colno } = options;
  const message = getErrorMessage(error);

  if (verbosity === 'simple') {
    return message;
  }

  const { causes, fixCode, fixComment, documentationUrl, severity } = extractErrorParts(error);
  const severityLabel = getSeverityLabel(severity);

  if (verbosity === 'medium' && (templatePath || lineno !== undefined || colno !== undefined)) {
    return formatMediumText(message, severityLabel, error, templatePath, lineno, colno, causes, documentationUrl);
  }

  const formattedStack = formatStack(error);
  const parts: string[] = [
    `${severityLabel} ${message}`,
    ...formatCauses(causes),
    ...formatFix(fixCode, fixComment, documentationUrl),
    ...(formattedStack ? ['', formattedStack] : [])
  ];

  return pipe(parts, filter(Boolean), join('\n'));
};

export { toText };
export type { ToTextOptions };
