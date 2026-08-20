import type { LineBase } from '@nunjucks/error-catalog';
import { isErrorLike } from '@nunjucks/error-catalog';
import { slice } from '@nunjucks/lib';
import picocolors from 'picocolors';
import { filter, join, map, pipe, split } from 'remeda';
import { mergeErrorParts } from '../presentation/error/error-parts.ts';
import { toDisplayLocation } from '../presentation/source-trace/location.ts';
import type { SourceTrace } from '../presentation/source-trace/source-trace.ts';
import { stripInlineMarkdown } from '../strip-inline-markdown.ts';
import { renderContextAnsi } from './context-helpers';
import { sanitizeTerminalText } from './sanitize-helpers.ts';
import { formatSourceTrace } from './source-helpers';
import {
  formatLocationString,
  formatStackLine,
  getExtrasPart,
  getSeverityLabel,
} from './stack-helpers.ts';

export { extractAnsiErrorParts, formatFullAnsi, formatMediumAnsi };

const BULLET = `${picocolors.yellow('•')} `;

const formatCausesAnsi = (causes: readonly string[]): string => {
  if (!causes || causes.length === 0) {
    return '';
  }
  const items = pipe(
    causes,
    map((c) => `  ${BULLET}${stripInlineMarkdown(sanitizeTerminalText(c))}`),
    join('\n')
  );
  return `\n${picocolors.bold('Possible Causes:')}\n${items}\n`;
};

interface FormatFixAnsiInput {
  fixCode: string | null;
  fixComment: string | null;
  documentationUrl: string | null;
}

const formatFixAnsi = ({ fixCode, fixComment, documentationUrl }: FormatFixAnsiInput): string => {
  if (!fixCode) {
    return '';
  }

  const parts: string[] = [
    `${picocolors.bold('Suggested Fix:')}`,
    ...(fixComment
      ? [picocolors.dim(`// ${stripInlineMarkdown(sanitizeTerminalText(fixComment))}`)]
      : []),
    picocolors.green(sanitizeTerminalText(fixCode)),
    ...(documentationUrl
      ? [`\n${picocolors.dim(`Learn more: ${sanitizeTerminalText(documentationUrl)}`)}`]
      : []),
  ];

  return parts.join('\n');
};

const LEADING_AT_RE = /^ at /;

interface MediumAnsiInput {
  path: string;
  location: ReturnType<typeof toDisplayLocation>;
  causes: string[];
  documentationUrl: string | null;
  ide: string;
}

/** Formats a one-line ANSI summary: message, location, and the first cause/docs hint. */
const formatMediumAnsi = (message: string, input: MediumAnsiInput): string => {
  const [firstCause] = input.causes;
  const causeHint = firstCause ? stripInlineMarkdown(sanitizeTerminalText(firstCause)) : '';
  const docHint = input.documentationUrl ? sanitizeTerminalText(input.documentationUrl) : '';
  const extrasPart = getExtrasPart(causeHint, docHint);
  const locationPart = input.path
    ? formatLocationString({ path: input.path, location: input.location, ide: input.ide }).replace(
        LEADING_AT_RE,
        ''
      )
    : ` at line ${input.location.line}`;
  return `${message}${locationPart}${extrasPart}`;
};

interface AnsiErrorParts {
  causes: string[];
  fixCode: string;
  fixComment: string;
  documentationUrl: string | null;
  severity: 'error' | 'warning' | 'info' | undefined;
  path: string;
  displayLineno: number | null;
  displayColno: number | null;
  lineBase: LineBase | null;
}

interface ExtractAnsiErrorPartsInput {
  error: unknown;
  templatePath?: string;
  lineno?: number | null;
  colno?: number | null;
}

/**
 * Extracts catalog parts plus display-location inputs from an error, preferring explicit
 * caller coordinates over the error's own fields; missing values degrade to `''`/`null`.
 */
const extractAnsiErrorParts = ({
  error,
  templatePath,
  lineno,
  colno,
}: ExtractAnsiErrorPartsInput): AnsiErrorParts => {
  const parts = mergeErrorParts(error);
  const errObj = isErrorLike(error) ? error : {};
  return {
    ...parts,
    severity: errObj.severity,
    path: templatePath ?? errObj.templateName ?? '',
    displayLineno: lineno ?? errObj.lineno ?? null,
    displayColno: colno ?? errObj.colno ?? null,
    lineBase: errObj.lineBase ?? 'zero',
  };
};

interface FullAnsiInput {
  parts: AnsiErrorParts;
  ide: string;
  sourceTrace: SourceTrace | null | undefined;
  renderContext: Record<string, unknown> | undefined;
  error: unknown;
}

/**
 * Assembles the full ANSI diagnostic: severity-colored header, source trace with caret,
 * possible causes, suggested fix, sanitized render context, and linkified stack frames.
 * Empty sections are dropped rather than rendered as blanks.
 */
const formatFullAnsi = (message: string, input: FullAnsiInput): string => {
  const { parts, ide, sourceTrace, renderContext, error } = input;
  const { causes, fixCode, fixComment, documentationUrl, severity, path } = parts;
  const location = toDisplayLocation({
    lineno: parts.displayLineno,
    colno: parts.displayColno,
    lineBase: parts.lineBase,
  });
  const stack = (isErrorLike(error) ? error.stack : undefined) ?? '';
  const formattedStack = pipe(
    stack,
    split('\n'),
    slice(1),
    filter((line) => line.trim().startsWith('at ')),
    map((line) => formatStackLine(line, ide)),
    join('\n')
  );
  const locationStr = formatLocationString({ path, location, ide });
  const severityLabel = getSeverityLabel(severity);
  const header = `${severityLabel} ${message}${locationStr}\n`;

  const blockedKeys = (isErrorLike(error) ? error.blockedKeys : undefined) ?? null;
  const causesStr = formatCausesAnsi(causes);
  const fixStr = formatFixAnsi({ fixCode, fixComment, documentationUrl });
  const outputParts: string[] = [
    header,
    ...((sourceTrace?.lines.length ?? 0) > 0
      ? [
          picocolors.bold('Source Trace:'),
          formatSourceTrace(sourceTrace?.lines ?? [], sourceTrace?.caret ?? null).join('\n'),
        ]
      : []),
    ...(causesStr ? [causesStr] : []),
    ...(fixStr ? [fixStr] : []),
    ...(renderContext ? [renderContextAnsi(renderContext, blockedKeys)] : []),
    `\n${picocolors.bold('Stack Trace:')}\n${formattedStack}`,
  ];

  return pipe(outputParts, filter(Boolean), join('\n'));
};
