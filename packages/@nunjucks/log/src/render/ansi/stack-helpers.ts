import { pipe, filter, join } from 'remeda';
import picocolors from 'picocolors';
import { shortenPath } from '../internal/path-shortener.ts';
import { isFilePath, resolveIdeLink } from '../internal/ide-links.ts';
import { stripMarkdown } from '../internal/markdown.ts';
import { parseStackFrame } from '../internal/stack-parse.ts';

export { makeHyperlink, stripMarkdown, getSeverityColor, getSeverityLabel, getExtrasPart, formatStackLine, formatLocationString };

const makeHyperlink = (text: string, url: string): string => `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;

const getSeverityColor = (severity?: string): ((text: string) => string) => {
  if (severity === 'warning') { return picocolors.yellow; }
  if (severity === 'info') { return picocolors.blue; }
  return picocolors.red;
};

const getSeverityLabel = (severity?: string): ReturnType<typeof picocolors.bold> =>
  picocolors.bold(getSeverityColor(severity)('Error:'));

const getExtrasPart = (causeHint: string, docHint: string): string => {
  const extras = pipe([causeHint, docHint], filter(Boolean), join(' | '));
  if (!extras) { return ''; }
  return `\n${extras}`;
};

const formatStackLine = (
  line: string,
  ide: string
): string => {
  const frame = parseStackFrame(line);
  if (!(frame.path && frame.line !== null)) {
    return `  ${frame.raw}`;
  }

  const lineNum = frame.line;
  const colNum = frame.col ?? 1;
  const shortPath = shortenPath(frame.path);
  const fn = frame.fn;
  const location = `${shortPath}:${lineNum}:${colNum}`;

  if (isFilePath(frame.path)) {
    const url = makeHyperlink(location, resolveIdeLink(ide, frame.path, lineNum, colNum));
    if (fn) { return `  at ${picocolors.cyan(fn)} (${url})`; }
    return `  at ${url}`;
  }
  if (fn) { return `  at ${fn} (${location})`; }
  return `  at ${location}`;
};

const formatLocationString = (
  path: string,
  location: { line: number; col: number },
  ide: string
): string => {
  if (!path) { return ''; }
  const shortPath = shortenPath(path);
  if (isFilePath(path)) {
    const url = makeHyperlink(`${shortPath}:${location.line}:${location.col}`, resolveIdeLink(ide, path, location.line, location.col));
    return ` at ${url}`;
  }
  return ` at ${shortPath}:${location.line}:${location.col}`;
};
