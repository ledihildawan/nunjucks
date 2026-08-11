import picocolors from 'picocolors';
import { highlightAnsi } from '../presentation/syntax-highlight/highlight.ts';
import type { SourceTraceLine, SourceTraceCaret } from '../presentation/source-trace/source-trace.ts';

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

interface FormatCodeLineInput {
  lineNum: number;
  content: string;
  isError: boolean;
  lineNumWidth: number;
}

const formatCodeLine = ({ lineNum, content, isError, lineNumWidth }: FormatCodeLineInput): string => {
  const marker = getMarker(isError);
  const lineNumStr = String(lineNum).padStart(lineNumWidth, ' ');
  const highlighted = isError ? highlightAnsi(content) : picocolors.dim(highlightAnsi(content));
  return `${marker}${picocolors.dim(lineNumStr)}${picocolors.dim(SEPARATOR)}${highlighted}`;
};

const getLinePrefix = (lineNumWidth: number): string =>
  picocolors.dim(`${NORMAL_MARKER}${' '.repeat(lineNumWidth)}${SEPARATOR}`);

interface FormatCaretLineInput {
  lineNumWidth: number;
  charStart: number;
  carets: string;
}

const formatCaretLine = ({ lineNumWidth, charStart, carets }: FormatCaretLineInput): string => {
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
    const codeLine = formatCodeLine({ lineNum: line.number, content: line.content, isError: line.isError, lineNumWidth });
    if (!(line.isError && caret)) {
      return [codeLine];
    }
    return [codeLine, formatCaretLine({ lineNumWidth, charStart: caret.charStart, carets: caret.carets })];
  });
};
