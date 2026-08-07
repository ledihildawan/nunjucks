import picocolors from 'picocolors';
import type { SourceTraceLine, SourceTraceCaret } from '../internal/location/source-trace.ts';

export { formatSourceTrace, formatCodeLine, getLinePrefix, formatCaretLine, getMarker, getLineNumWidth };

const SEPARATOR = ' │ ';
const ERROR_MARKER = '> ';
const NORMAL_MARKER = '  ';
const MIN_LINE_NUM_WIDTH = 2;

const getMarker = (isError: boolean): string => {
  if (isError) { return ERROR_MARKER; }
  return NORMAL_MARKER;
};

const getLineNumWidth = (lines: SourceTraceLine[]): number => {
  const maxLineNum = Math.max(...lines.map(l => l.number));
  return Math.max(MIN_LINE_NUM_WIDTH, String(maxLineNum).length);
};

const formatCodeLine = (
  lineNum: number,
  content: string,
  isError: boolean,
  lineNumWidth: number
): string => {
  const marker = getMarker(isError);
  const lineNumStr = String(lineNum).padStart(lineNumWidth, ' ');
  return picocolors.dim(`${marker}${lineNumStr}${SEPARATOR}${content}`);
};

const getLinePrefix = (lineNumWidth: number): string =>
  picocolors.dim(`${NORMAL_MARKER}${' '.repeat(lineNumWidth)}${SEPARATOR}`);

const formatCaretLine = (
  lineNumWidth: number,
  charStart: number,
  carets: string
): string => {
  const prefix = getLinePrefix(lineNumWidth);
  return `${prefix}${' '.repeat(charStart)}${picocolors.red(carets)}`;
};

const formatSourceTrace = (
  lines: SourceTraceLine[],
  caret: SourceTraceCaret | null
): string[] => {
  if (lines.length === 0) { return []; }

  const lineNumWidth = getLineNumWidth(lines);

  return lines.flatMap((line) => {
    const codeLine = formatCodeLine(line.number, line.content, line.isError, lineNumWidth);
    if (!(line.isError && caret)) {
      return [codeLine];
    }
    return [codeLine, formatCaretLine(lineNumWidth, caret.charStart, caret.carets)];
  });
};
