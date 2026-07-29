import { pipe, filter, join } from 'remeda';
import picocolors from 'picocolors';
import { shortenPath } from '../internal/path-shortener.ts';
import { isFilePath, resolveIdeLink } from '../internal/ide-links.ts';

export { makeHyperlink, stripMarkdown, getSeverityColor, getSeverityLabel, getExtrasPart, formatStackLine, formatLocationString };

const makeHyperlink = (text: string, url: string): string => `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;

const stripMarkdown = (text: string): string => text.replace(/\*\*([^*]+)\*\*/gu, '$1').replace(/`([^`]+)`/gu, '$1');

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

const STACK_LOCATION_RE = /\(([^()]+):(\d+):(\d+)\)$/u;
const STACK_FUNCTION_RE = /^at\s+([^\s]+)/u;

const formatStackLine = (
  line: string,
  ide: string
): string => {
  const trimmed = line.trim();
  const pathMatch = trimmed.match(STACK_LOCATION_RE);
  if (!(pathMatch?.[1] && pathMatch[2])) {
    return `  ${trimmed}`;
  }

  const [, fullPath, lineNumRaw, colGroup] = pathMatch;
  const lineNum = Number.parseInt(lineNumRaw, 10);
  const colNum = colGroup ? Number.parseInt(colGroup, 10) : 1;
  const shortPath = shortenPath(fullPath);
  const fnMatch = trimmed.match(STACK_FUNCTION_RE);
  const fn = fnMatch?.[1] ?? '';
  const location = `${shortPath}:${lineNum}:${colNum}`;

  if (isFilePath(fullPath)) {
    const url = makeHyperlink(location, resolveIdeLink(ide, fullPath, lineNum, colNum));
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
