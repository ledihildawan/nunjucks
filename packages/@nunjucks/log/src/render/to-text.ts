import { shortenPath } from './internal/path-shortener.ts';
import { toDisplayLocation } from './internal/location.ts';
import { classifyFromError } from '../errors/classify.ts';

export interface ToTextOptions {
  verbosity?: 'simple' | 'medium' | 'full';
  templatePath?: string;
  lineno?: number | null;
  colno?: number | null;
}

const stripMarkdown = (text: string): string => {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
};

export const toText = (error: unknown, options: ToTextOptions = {}): string => {
  if (!error) return '';

  const { verbosity = 'full', templatePath, lineno, colno } = options;

  let message = (error as Error).message;
  if (!message || typeof message !== 'string') {
    message = String(error);
  }

  const firstStackLine = message.indexOf('\n    at ');
  if (firstStackLine !== -1) {
    message = message.substring(0, firstStackLine);
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
    suggestion?: string | null;
    documentationUrl?: string | null;
    relatedLinks?: Array<{ label: string; url: string }>;
    severity?: 'error' | 'warning' | 'info';
  };

  const classification = classifyFromError(errObj);
  const causes = classification.causes && classification.causes.length > 0
    ? classification.causes
    : (errObj.causes || []);
  const fixCode = classification.fixCode ?? errObj.fixCode ?? '';
  const fixComment = classification.fixComment ?? errObj.fixComment ?? '';
  const suggestion = classification.suggestion ?? errObj.suggestion ?? null;
  const documentationUrl = classification.documentationUrl ?? errObj.documentationUrl ?? null;
  const relatedLinks = classification.relatedLinks ?? errObj.relatedLinks ?? [];

  const severityLabel = errObj.severity === 'warning' ? 'Warning:' : errObj.severity === 'info' ? 'Info:' : 'Error:';

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
    const causeHint = causes.length > 0 ? `\n${stripMarkdown(causes[0])}` : '';
    const sugHint = suggestion ? `\n💡 Tip: ${stripMarkdown(suggestion)}` : '';
    return `${severityLabel} ${message}${locationStr}${causeHint}${sugHint}`;
  }

  const stack = (error as Error).stack || '';
  const stackLines = stack.split('\n').slice(1);

  const formattedStack = stackLines
    .map(line => {
      const trimmed = line.trim();
      const pathMatch = trimmed.match(/\(([^()]+):(\d+):(\d+)\)$/);
      if (pathMatch?.[1] && pathMatch[2]) {
        const fullPath = pathMatch[1];
        const lineNum = pathMatch[2];
        const shortPath = shortenPath(fullPath);
        const fnMatch = trimmed.match(/^at\s+([^\s]+)/);
        const fn = fnMatch?.[1] ?? '';
        return fn ? `  at ${fn} (${shortPath}:${lineNum})` : `  at ${shortPath}:${lineNum}`;
      }
      return `  ${trimmed}`;
    })
    .join('\n');

  const parts: string[] = [`${severityLabel} ${message}`];

  if (causes.length > 0) {
    parts.push('');
    parts.push('Possible Causes:');
    causes.forEach(c => parts.push(`  • ${stripMarkdown(c)}`));
  }

  if (fixCode) {
    parts.push('');
    parts.push('Suggested Fix:');
    if (fixComment) parts.push(`  // ${stripMarkdown(fixComment)}`);
    parts.push(`  ${fixCode}`);
  }

  if (suggestion) {
    parts.push('');
    parts.push(`💡 Tip: ${stripMarkdown(suggestion)}`);
  }

  if (documentationUrl || relatedLinks.length > 0) {
    parts.push('');
    parts.push('Learn More:');
    if (documentationUrl) parts.push(`  ${documentationUrl}`);
    relatedLinks.forEach(l => parts.push(`  ${l.label}: ${l.url}`));
  }

  if (formattedStack) {
    parts.push('');
    parts.push(formattedStack);
  }

  return parts.filter(Boolean).join('\n');
};
