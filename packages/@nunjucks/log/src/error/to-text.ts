import { shortenPath } from '@nunjucks/shared/path-shortener';
import { toDisplayLocation } from './location.ts';

export interface ToTextOptions {
  verbosity?: 'simple' | 'medium' | 'full';
  templatePath?: string;
  lineno?: number | null;
  colno?: number | null;
}

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
    return `${message}${locationStr}`;
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

  return formattedStack ? `${message}\n${formattedStack}` : message;
};
