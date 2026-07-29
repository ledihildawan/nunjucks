import { pipe, filter, join, split } from 'remeda';
import picocolors from 'picocolors';
import { toDisplayLocation } from '../internal/location.ts';
import { classifyFromError } from '../../errors/classify.ts';
import type { SourceTrace } from '../internal/source-trace.ts';
import { stripMarkdown, getSeverityLabel, getExtrasPart, formatStackLine, formatLocationString } from './stack-helpers';
import { renderContextAnsi } from './context-helpers';
import { formatSourceTrace } from './source-helpers';
import { slice } from '@nunjucks/shared';
import { getErrorMessage } from '../internal/message.ts';

export { formatCausesAnsi, formatFixAnsi, getErrorMessage, formatMediumAnsi, extractAnsiErrorParts, formatFullAnsi, BULLET };

const BULLET = `${picocolors.yellow('•')} `;

const formatCausesAnsi = (causes: readonly string[]): string => {
  if (!causes || causes.length === 0) { return ''; }
  const items = causes.map(c => `  ${BULLET}${stripMarkdown(c)}`).join('\n');
  return `\n${picocolors.bold('Possible Causes:')}\n${items}\n`;
};

const formatFixAnsi = (fixCode: string | null, fixComment: string | null, documentationUrl: string | null): string => {
  if (!fixCode) { return ''; }

  const parts: string[] = [
    `${picocolors.bold('Suggested Fix:')}`,
    ...(fixComment ? [picocolors.dim(`// ${stripMarkdown(fixComment)}`)] : []),
    picocolors.green(fixCode),
    ...(documentationUrl ? [`\n${picocolors.dim(`Learn more: ${documentationUrl}`)}`] : [])
  ];

  return parts.join('\n');
};

const LEADING_AT_RE = /^ at /;

const formatMediumAnsi = (message: string, path: string, location: ReturnType<typeof toDisplayLocation>, causes: string[], documentationUrl: string | null, ide: string): string => {
  const [firstCause] = causes;
  const causeHint = firstCause ? stripMarkdown(firstCause) : '';
  const extrasPart = getExtrasPart(causeHint, documentationUrl || '');
  const locationPart = path
    ? formatLocationString(path, location, ide).replace(LEADING_AT_RE, '')
    : ` at line ${location.line}`;
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
  lineBase: 'zero' | 'one' | null;
}

const extractAnsiErrorParts = (error: unknown, templatePath?: string, lineno?: number | null, colno?: number | null): AnsiErrorParts => {
  const errObj = error as {
    templateName?: string;
    lineno?: number | null;
    colno?: number | null;
    lineBase?: 'zero' | 'one' | null;
    causes?: string[];
    fixCode?: string | null;
    fixComment?: string | null;
    documentationUrl?: string | null;
    severity?: 'error' | 'warning' | 'info';
  };
  const classification = classifyFromError(errObj);
  return {
    causes: classification.causes?.length ? [...classification.causes] : [...(errObj.causes || [])],
    fixCode: classification.fixCode ?? errObj.fixCode ?? '',
    fixComment: classification.fixComment ?? errObj.fixComment ?? '',
    documentationUrl: classification.documentationUrl ?? errObj.documentationUrl ?? null,
    severity: errObj.severity,
    path: templatePath || errObj.templateName || '',
    displayLineno: lineno ?? errObj.lineno ?? null,
    displayColno: colno ?? errObj.colno ?? null,
    lineBase: errObj.lineBase ?? 'zero',
  };
};

const formatFullAnsi = (
  message: string,
  parts: AnsiErrorParts,
  ide: string,
  sourceTrace: SourceTrace | null | undefined,
  renderContext: Record<string, unknown> | undefined
): string => {
  const { causes, fixCode, fixComment, documentationUrl, severity, path } = parts;
  const location = toDisplayLocation(parts.displayLineno, parts.displayColno, parts.lineBase);
  const stack = (sourceTrace as unknown as Error).stack || '';
  const stackLines = pipe(stack, split('\n'), slice(1));
  const formattedStack = stackLines.map(line => formatStackLine(line, ide)).join('\n');
  const locationStr = formatLocationString(path, location, ide);
  const severityLabel = getSeverityLabel(severity);
  const header = `${severityLabel} ${message}${locationStr}\n`;

  const causesStr = formatCausesAnsi(causes);
  const fixStr = formatFixAnsi(fixCode, fixComment, documentationUrl);
  const outputParts: string[] = [
    header,
    ...((sourceTrace && sourceTrace.lines.length > 0)
      ? [picocolors.bold('Source Trace:'), formatSourceTrace(sourceTrace.lines, sourceTrace.caret).join('\n')]
      : []),
    ...(causesStr ? [causesStr] : []),
    ...(fixStr ? [fixStr] : []),
    ...(renderContext ? [renderContextAnsi(renderContext)] : []),
    `\n${picocolors.bold('Stack Trace:')}\n${formattedStack}`
  ];

  return pipe(outputParts, filter(Boolean), join('\n'));
};
