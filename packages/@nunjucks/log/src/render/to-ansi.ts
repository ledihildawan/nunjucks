import picocolors from 'picocolors';
import { keys, entries, forEachObj } from 'remeda';
import { shortenPath } from './internal/path-shortener.ts';
import { toDisplayLocation } from './internal/location.ts';
import { isFilePath, resolveIdeLink } from './internal/ide-links.ts';
import { normalizeRenderContext } from './internal/safe-context.ts';

export interface AnsiOptions {
  verbosity?: 'simple' | 'medium' | 'full';
  templatePath?: string;
  lineno?: number | null;
  colno?: number | null;
  ide?: string;
  sourceContent?: string;
  sourceStartLine?: number;
  renderContext?: Record<string, unknown>;
}

const sanitizeForAnsi = (value: unknown, seen?: WeakSet<object>): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return '[Function: ' + (value.name || 'anonymous') + ']';
  if (typeof value === 'object') {
    if (seen?.has(value as object)) return '[Circular]';
    const newSeen = seen || new WeakSet();
    newSeen.add(value as object);
    if (Array.isArray(value)) {
      return 'Array(' + value.length + ')';
    }
    return 'Object(' + keys(value).length + ')';
  }
  if (typeof value === 'string') return '"' + value + '"';
  return String(value);
};

const renderContextAnsi = (context: Record<string, unknown>): string => {
  const normalized = normalizeRenderContext(context);
  const lines: string[] = [];
  lines.push(picocolors.bold('Render Context:'));
  const renderValue = (key: string, value: unknown, indent = 0): string => {
    const prefix = '  '.repeat(indent);
    if (value === null || value === undefined) {
      return `${prefix}${key}: ${sanitizeForAnsi(value)}`;
    }
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `${prefix}${key}: ${sanitizeForAnsi(value)}`;
      }
      const obj = value as Record<string, unknown>;
      const k = keys(obj);
      if (k.length === 0) {
        return `${prefix}${key}: (empty)`;
      }
      const entryStrs = k.map(k => `${prefix}  ${k}: ${sanitizeForAnsi(obj[k])}`).join('\n');
      return `${prefix}${key}:\n${entryStrs}`;
    }
    return `${prefix}${key}: ${sanitizeForAnsi(value)}`;
  };
  forEachObj(normalized as Record<string, unknown>, (value, key) => {
    lines.push(renderValue(key, value));
  });
  return lines.join('\n');
};

const makeHyperlink = (text: string, url: string): string => {
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
};

export const toAnsi = (error: unknown, options: AnsiOptions = {}): string => {
  if (!error) return '';

  const { verbosity = 'full', templatePath, lineno, colno, ide = 'vscode', sourceStartLine = 1 } = options;

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

  const path = templatePath || (error as { templateName?: string }).templateName || '';
  const displayLineno = lineno ?? (error as { lineno?: number | null }).lineno ?? null;
  const displayColno = colno ?? (error as { colno?: number | null }).colno ?? null;
  const lineBase = (error as { lineBase?: 'zero' | 'one' | null }).lineBase ?? 'zero';

  const location = toDisplayLocation(displayLineno, displayColno, lineBase);

  if (verbosity === 'medium') {
    if (path) {
      const shortPath = shortenPath(path);
      if (isFilePath(path)) {
        const url = makeHyperlink(`${shortPath}:${location.line}:${location.col}`, resolveIdeLink(ide, path, location.line, location.col));
        return `${message} at ${url}`;
      }
      return `${message} at ${shortPath}:${location.line}:${location.col}`;
    }
    return `${message} at line ${location.line}`;
  }

  const stack = (error as Error).stack || '';
  const stackLines = stack.split('\n').slice(1);

  const formattedStack = stackLines
    .map(line => {
      const trimmed = line.trim();
      const pathMatch = trimmed.match(/\(([^()]+):(\d+):(\d+)\)$/);
      if (pathMatch?.[1] && pathMatch[2]) {
        const fullPath = pathMatch[1];
        const lineNum = parseInt(pathMatch[2], 10);
        const colNum = pathMatch[3] ? parseInt(pathMatch[3], 10) : 1;
        const shortPath = shortenPath(fullPath);
        const fnMatch = trimmed.match(/^at\s+([^\s]+)/);
        const fn = fnMatch?.[1] ?? '';
        if (isFilePath(fullPath)) {
          const url = makeHyperlink(`${shortPath}:${lineNum}`, resolveIdeLink(ide, fullPath, lineNum, colNum));
          return fn ? `  at ${picocolors.cyan(fn)} (${url})` : `  at ${url}`;
        }
        return fn ? `  at ${fn} (${shortPath}:${lineNum}:${colNum})` : `  at ${shortPath}:${lineNum}:${colNum}`;
      }
      return `  ${trimmed}`;
    })
    .join('\n');

  let locationStr = '';
  if (path) {
    const shortPath = shortenPath(path);
    if (isFilePath(path)) {
      const url = makeHyperlink(`${shortPath}:${location.line}:${location.col}`, resolveIdeLink(ide, path, location.line, location.col));
      locationStr = ` at ${url}`;
    } else {
      locationStr = ` at ${shortPath}:${location.line}:${location.col}`;
    }
  }

  const header = `${picocolors.bold(picocolors.red('Error:'))} ${message}${locationStr}`;

  const parts: string[] = [header];

  if (options.sourceContent && displayLineno !== null) {
    const lines = options.sourceContent.split('\n');
    const errorLineIndex = displayLineno - sourceStartLine;
    const startLine = Math.max(0, errorLineIndex - 2);
    const endLine = Math.min(lines.length, errorLineIndex + 3);
    const snippetLines: string[] = [];
    for (let i = startLine; i < endLine; i++) {
      const lineNum = (options.sourceStartLine ?? 1) + i;
      const marker = i === errorLineIndex ? '> ' : '  ';
      snippetLines.push(`${marker}${lineNum} | ${lines[i]}`);
    }
    if (snippetLines.length > 0) {
      parts.push(picocolors.bold('Source:'));
      snippetLines.forEach(snippetLine => {
        parts.push(picocolors.dim(snippetLine));
      });
    }
  }

  if (options.renderContext && verbosity === 'full') {
    parts.push(renderContextAnsi(options.renderContext));
  }

  parts.push(formattedStack);

  return parts.filter(Boolean).join('\n');
};
