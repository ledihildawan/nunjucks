import { shortenPath } from './internal/path-shortener.ts';
import { toDisplayLocation } from './internal/location.ts';
import { classifyFromError } from '../errors/classify.ts';

interface ToTextOptions {
  verbosity?: 'simple' | 'medium' | 'full';
  templatePath?: string;
  lineno?: number | null;
  colno?: number | null;
}

const BOLD_MARKDOWN_RE = /\*\*([^*]+)\*\*/gu;
const CODE_MARKDOWN_RE = /`([^`]+)`/gu;
const STACK_LOCATION_RE = /\(([^()]+):(\d+):(\d+)\)$/u;
const STACK_FUNCTION_RE = /^at\s+([^\s]+)/u;

const stripMarkdown = (text: string): string => text.replace(BOLD_MARKDOWN_RE, '$1').replace(CODE_MARKDOWN_RE, '$1');

const toText = (error: unknown, options: ToTextOptions = {}): string => {
  if (!error) { return ''; }

  const { verbosity = 'full', templatePath, lineno, colno } = options;

  let { message } = error as Error;
  if (!message || typeof message !== 'string') {
    message = String(error);
  }

  const firstStackLine = message.indexOf('\n    at ');
  if (firstStackLine !== -1) {
    message = message.slice(0, firstStackLine);
  }

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
  let causes: string[];
  if (classification.causes && classification.causes.length > 0) {
    causes = [...classification.causes];
  } else {
    causes = [...(errObj.causes || [])];
  }
  const fixCode = classification.fixCode ?? errObj.fixCode ?? '';
  const fixComment = classification.fixComment ?? errObj.fixComment ?? '';
  const documentationUrl = classification.documentationUrl ?? errObj.documentationUrl ?? null;

  let severityLabel: string;
  if (errObj.severity === 'warning') {
    severityLabel = 'Warning:';
  } else if (errObj.severity === 'info') {
    severityLabel = 'Info:';
  } else {
    severityLabel = 'Error:';
  }

  let locationStr = '';
  if (
    verbosity === 'medium' &&
    (
      Boolean(templatePath) ||
      lineno !== undefined && lineno !== null ||
      colno !== undefined && colno !== null
    )
  ) {
    const path = templatePath || (error as { templateName?: string }).templateName || 'unknown';
    const location = toDisplayLocation(
      lineno ?? (error as { lineno?: number | null }).lineno ?? null,
      colno ?? (error as { colno?: number | null }).colno ?? null,
      (error as { lineBase?: 'zero' | 'one' | null }).lineBase ?? 'zero'
    );
    const shortPath = shortenPath(path);
    locationStr = ` at ${shortPath}:${location.line}:${location.col}`;
    let causeHint: string;
    if (causes.length > 0) {
      causeHint = stripMarkdown(causes[0] ?? '');
    } else {
      causeHint = '';
    }
    let docHint: string;
    if (documentationUrl) {
      docHint = documentationUrl;
    } else {
      docHint = '';
    }
    const extras = [causeHint, docHint].filter(Boolean).join(' | ');
    let extrasPart = '';
    if (extras) {
      extrasPart = `\n${extras}`;
    }
    return `${severityLabel} ${message}${locationStr}${extrasPart}`;
  }

  const stack = (error as Error).stack || '';
  const stackLines = stack.split('\n').slice(1);

  const formattedStack = stackLines
    .map(line => {
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
    })
    .join('\n');

  const parts: string[] = [`${severityLabel} ${message}`];

  if (causes.length > 0) {
    parts.push('');
    parts.push('Possible Causes:');
    for (const c of causes) { parts.push(`  • ${stripMarkdown(c)}`); }
  }

  if (fixCode) {
    parts.push('');
    parts.push('Suggested Fix:');
    if (fixComment) { parts.push(`  // ${stripMarkdown(fixComment)}`); }
    parts.push(`  ${fixCode}`);
    if (documentationUrl) { parts.push(`  Learn more: ${documentationUrl}`); }
  }

  if (formattedStack) {
    parts.push('');
    parts.push(formattedStack);
  }

  return parts.filter(Boolean).join('\n');
};

export { toText };
export type { ToTextOptions };
