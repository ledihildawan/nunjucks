import picocolors from 'picocolors';
import { filter, join, pipe } from 'remeda';
import { isFilePath, resolveIdeLink } from '../presentation/ide-links/ide-links.ts';
import { shortenPath } from '../presentation/source-trace/path-shortener.ts';
import { parseStackFrame } from '../presentation/source-trace/stack-parse.ts';
import { stripInlineMarkdown } from '../strip-inline-markdown.ts';
import { createHyperlink } from './hyperlink.ts';

export { createHyperlink } from './hyperlink.ts';
export {
  formatLocationString,
  formatStackLine,
  getExtrasPart,
  getSeverityLabel,
  stripInlineMarkdown,
};

const getSeverityColor = (severity?: string): ((text: string) => string) => {
  if (severity === 'warning') {
    return picocolors.yellow;
  }
  if (severity === 'info') {
    return picocolors.blue;
  }
  return picocolors.red;
};

/** Formats the severity label, bolded and colored red/yellow/blue by severity. */
const getSeverityLabel = (severity?: string): ReturnType<typeof picocolors.bold> =>
  picocolors.bold(getSeverityColor(severity)('Error:'));

/** Joins the first cause hint and docs URL into a ` | `-separated suffix, or `''`. */
const getExtrasPart = (causeHint: string, docHint: string): string => {
  const extras = pipe([causeHint, docHint], filter(Boolean), join(' | '));
  if (!extras) {
    return '';
  }
  return `\n${extras}`;
};

/**
 * Formats one stack frame for ANSI output, shortening the path and wrapping real file
 * locations in a terminal hyperlink to the configured IDE; unparseable frames pass
 * through as raw text.
 */
const formatStackLine = (line: string, ide: string): string => {
  const frame = parseStackFrame(line);
  if (!(frame.path && frame.line !== null)) {
    return `  ${frame.raw}`;
  }

  const lineNum = frame.line;
  const colNum = frame.col ?? 1;
  const shortPath = shortenPath(frame.path, '');
  const fn = frame.fn;
  const location = `${shortPath}:${lineNum}:${colNum}`;

  if (isFilePath(frame.path)) {
    const url = createHyperlink(
      location,
      resolveIdeLink(ide, { path: frame.path, line: lineNum, col: colNum })
    );
    if (fn) {
      return `  at ${picocolors.cyan(fn)} (${url})`;
    }
    return `  at ${url}`;
  }
  if (fn) {
    return `  at ${fn} (${location})`;
  }
  return `  at ${location}`;
};

interface FormatLocationStringInput {
  path: string;
  location: { line: number; col: number };
  ide: string;
}

/**
 * Formats the ` at path:line:col` location suffix, hyperlinking it to the configured
 * IDE when the path is a real file; an empty path yields an empty string.
 */
const formatLocationString = ({ path, location, ide }: FormatLocationStringInput): string => {
  if (!path) {
    return '';
  }
  const shortPath = shortenPath(path, '');
  if (isFilePath(path)) {
    const url = createHyperlink(
      `${shortPath}:${location.line}:${location.col}`,
      resolveIdeLink(ide, { path, line: location.line, col: location.col })
    );
    return ` at ${url}`;
  }
  return ` at ${shortPath}:${location.line}:${location.col}`;
};
