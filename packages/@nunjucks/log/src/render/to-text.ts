import { pipe, filter, join, map, split } from 'remeda';
import { shortenPath } from './internal/path-shortener.ts';
import { toDisplayLocation } from './internal/location.ts';
import { classifyFromError } from '../errors/classify.ts';
import { slice } from '@nunjucks/shared';
import { stripMarkdown } from './internal/markdown.ts';
import { getErrorMessage } from './internal/message.ts';

interface ToTextOptions {
  verbosity?: 'simple' | 'medium' | 'full';
  templatePath?: string;
  lineno?: number | null;
  colno?: number | null;
}

const STACK_LOCATION_RE = /\(([^()]+):(\d+):(\d+)\)$/u;
const STACK_FUNCTION_RE = /^at\s+([^\s]+)/u;

const getSeverityLabel = (severity: 'error' | 'warning' | 'info' | undefined): string => {
  if (severity === 'warning') { return 'Warning:'; }
  if (severity === 'info') { return 'Info:'; }
  return 'Error:';
};

const formatStackLine = (line: string): string => {
  const trimmed = line.trim();
  const pathMatch = trimmed.match(STACK_LOCATION_RE);
  if (pathMatch?.[1] && pathMatch[2]) {
    const [, fullPath, lineNum] = pathMatch;
    const shortPath = shortenPath(fullPath);
    const fnMatch = trimmed.match(STACK_FUNCTION_RE);
    const fn = fnMatch?.[1] ?? '';
    if (fn) {
      return `  at ${fn} (${shortPath}:${lineNum})`;
    }
    return `  at ${shortPath}:${lineNum}`;
  }
  return `  ${trimmed}`;
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
  const path = templatePath || (error as { templateName?: string }).templateName || 'unknown';
  const location = toDisplayLocation(
    lineno ?? (error as { lineno?: number | null }).lineno ?? null,
    colno ?? (error as { colno?: number | null }).colno ?? null,
    (error as { lineBase?: 'zero' | 'one' | null }).lineBase ?? 'zero'
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

const extractErrorParts = (error: unknown, classification: ReturnType<typeof classifyFromError>): ErrorParts => {
  const errObj = error as {
    causes?: string[];
    fixCode?: string | null;
    fixComment?: string | null;
    documentationUrl?: string | null;
    severity?: 'error' | 'warning' | 'info';
  };
  return {
    causes: classification.causes?.length ? [...classification.causes] : [...(errObj.causes || [])],
    fixCode: classification.fixCode ?? errObj.fixCode ?? '',
    fixComment: classification.fixComment ?? errObj.fixComment ?? '',
    documentationUrl: classification.documentationUrl ?? errObj.documentationUrl ?? null,
    severity: errObj.severity,
  };
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

  const errObj = error as {
    code?: string | null;
    subject?: string | null;
    causes?: string[];
    fixCode?: string | null;
    fixComment?: string | null;
    documentationUrl?: string | null;
    severity?: 'error' | 'warning' | 'info';
  };

  const classification = classifyFromError(errObj);
  const { causes, fixCode, fixComment, documentationUrl, severity } = extractErrorParts(error, classification);
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
