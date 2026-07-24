import picocolors from 'picocolors';
import { keys, forEachObj } from 'remeda';
import { shortenPath } from './internal/path-shortener.ts';
import { toDisplayLocation } from './internal/location.ts';
import { isFilePath, resolveIdeLink } from './internal/ide-links.ts';
import { normalizeRenderContext } from './internal/safe-context.ts';
import { classifyFromError } from '../errors/classify.ts';

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
  if (value === null) { return 'null'; }
  if (value === undefined) { return 'undefined'; }
  if (typeof value === 'function') { return `[Function: ${value.name || 'anonymous'}]`; }
  if (typeof value === 'object') {
    if (seen?.has(value as object)) { return '[Circular]'; }
    const newSeen = seen || new WeakSet();
    newSeen.add(value as object);
    if (Array.isArray(value)) {
      return `Array(${value.length})`;
    }
    return `Object(${keys(value).length})`;
  }
  if (typeof value === 'string') { return `"${value}"`; }
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

const makeHyperlink = (text: string, url: string): string => `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;

const stripMarkdown = (text: string): string => text.replace(/\*\*([^*]+)\*\*/gu, '$1').replace(/`([^`]+)`/gu, '$1');

const formatCausesAnsi = (causes: readonly string[]): string => {
  if (!causes || causes.length === 0) { return ''; }
  const items = causes.map(c => `  ${picocolors.yellow('•')} ${stripMarkdown(c)}`).join('\n');
  return `\n${picocolors.bold('Possible Causes:')}\n${items}`;
};

const formatFixAnsi = (fixCode: string | null, fixComment: string | null, documentationUrl: string | null): string => {
  if (!fixCode) { return ''; }
  let out = `\n${picocolors.bold('Suggested Fix:')}`;
  if (fixComment) {
    out += `\n${picocolors.dim(`// ${stripMarkdown(fixComment)}`)}`;
  }
  out += `\n${picocolors.green(fixCode)}`;
  if (documentationUrl) {
    out += `\n${picocolors.dim(`Learn more: ${documentationUrl}`)}`;
  }
  return out;
};

export const toAnsi = (error: unknown, options: AnsiOptions = {}): string => {
  if (!error) { return ''; }

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
    causes = classification.causes;
  } else {
    causes = errObj.causes || [];
  }
  const fixCode = classification.fixCode ?? errObj.fixCode ?? '';
  const fixComment = classification.fixComment ?? errObj.fixComment ?? '';
  const documentationUrl = classification.documentationUrl ?? errObj.documentationUrl ?? null;

  const path = templatePath || (error as { templateName?: string }).templateName || '';
  const displayLineno = lineno ?? (error as { lineno?: number | null }).lineno ?? null;
  const displayColno = colno ?? (error as { colno?: number | null }).colno ?? null;
  const lineBase = (error as { lineBase?: 'zero' | 'one' | null }).lineBase ?? 'zero';

  const location = toDisplayLocation(displayLineno, displayColno, lineBase);

  if (verbosity === 'medium') {
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
    if (path) {
      const shortPath = shortenPath(path);
      if (isFilePath(path)) {
        const url = makeHyperlink(`${shortPath}:${location.line}:${location.col}`, resolveIdeLink(ide, path, location.line, location.col));
        let extrasPart = '';
        if (extras) {
          extrasPart = `\n${extras}`;
        }
        return `${message} at ${url}${extrasPart}`;
      }
      let extrasPart = '';
      if (extras) {
        extrasPart = `\n${extras}`;
      }
      return `${message} at ${shortPath}:${location.line}:${location.col}${extrasPart}`;
    }
    let extrasPart = '';
    if (extras) {
      extrasPart = `\n${extras}`;
    }
    return `${message} at line ${location.line}${extrasPart}`;
  }

  const stack = (error as Error).stack || '';
  const stackLines = stack.split('\n').slice(1);

  const formattedStack = stackLines
    .map(line => {
      const trimmed = line.trim();
      const pathMatch = trimmed.match(/\(([^()]+):(\d+):(\d+)\)$/u);
      if (pathMatch?.[1] && pathMatch[2]) {
        const fullPath = pathMatch[1];
        const lineNum = Number.parseInt(pathMatch[2], 10);
        let colNum: number;
        if (pathMatch[3]) {
          colNum = Number.parseInt(pathMatch[3], 10);
        } else {
          colNum = 1;
        }
        const shortPath = shortenPath(fullPath);
        const fnMatch = trimmed.match(/^at\s+([^\s]+)/u);
        const fn = fnMatch?.[1] ?? '';
        if (isFilePath(fullPath)) {
          const url = makeHyperlink(`${shortPath}:${lineNum}`, resolveIdeLink(ide, fullPath, lineNum, colNum));
          if (fn) {
            return `  at ${picocolors.cyan(fn)} (${url})`;
          }
          return `  at ${url}`;
        }
        if (fn) {
          return `  at ${fn} (${shortPath}:${lineNum}:${colNum})`;
        }
        return `  at ${shortPath}:${lineNum}:${colNum}`;
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

  let severityLabel: ReturnType<typeof picocolors.bold>;
  if (errObj.severity === 'warning') {
    severityLabel = picocolors.bold(picocolors.yellow('Warning:'));
  } else if (errObj.severity === 'info') {
    severityLabel = picocolors.bold(picocolors.blue('Info:'));
  } else {
    severityLabel = picocolors.bold(picocolors.red('Error:'));
  }

  const header = `${severityLabel} ${message}${locationStr}`;

  const parts: string[] = [header];

  if (options.sourceContent && displayLineno !== null) {
    const lines = options.sourceContent.split('\n');
    const errorLineIndex = displayLineno - sourceStartLine;
    const startLine = Math.max(0, errorLineIndex - 2);
    const endLine = Math.min(lines.length, errorLineIndex + 3);
    const snippetLines: string[] = [];
    for (let i = startLine; i < endLine; i++) {
      const lineNum = (options.sourceStartLine ?? 1) + i;
      let marker: string;
      if (i === errorLineIndex) {
        marker = '> ';
      } else {
        marker = '  ';
      }
      snippetLines.push(`${marker}${lineNum} | ${lines[i]}`);
    }
    if (snippetLines.length > 0) {
      parts.push(picocolors.bold('Source:'));
      snippetLines.forEach(snippetLine => {
        parts.push(picocolors.dim(snippetLine));
      });
    }
  }

  const causesStr = formatCausesAnsi(causes);
  if (causesStr) { parts.push(causesStr); }

  const fixStr = formatFixAnsi(fixCode, fixComment, documentationUrl);
  if (fixStr) { parts.push(fixStr); }

  if (options.renderContext && verbosity === 'full') {
    parts.push(renderContextAnsi(options.renderContext));
  }

  parts.push(formattedStack);

  return parts.filter(Boolean).join('\n');
};
