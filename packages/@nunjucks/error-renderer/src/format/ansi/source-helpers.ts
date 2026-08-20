import picocolors from 'picocolors';
import type {
  SourceTraceCaret,
  SourceTraceLine,
} from '../presentation/source-trace/source-trace.ts';
import { highlightAnsi } from '../presentation/syntax-highlight/highlight.ts';
import { sanitizeTerminalText } from './sanitize-helpers.ts';

export { formatSourceTrace };

const SEPARATOR = ' │ ';
const ERROR_MARKER = '> ';
const NORMAL_MARKER = '  ';
const MIN_LINE_NUM_WIDTH = 2;

const getMarker = (isError: boolean): string => {
  if (isError) {
    return ERROR_MARKER;
  }
  return NORMAL_MARKER;
};

const getLineNumWidth = (lines: SourceTraceLine[]): number => {
  if (lines.length === 0) {
    return MIN_LINE_NUM_WIDTH;
  }
  const maxLineNum = Math.max(...lines.map((line) => line.number));
  return Math.max(MIN_LINE_NUM_WIDTH, String(maxLineNum).length);
};

interface FormatCodeLineInput {
  lineNum: number;
  content: string;
  isError: boolean;
  lineNumWidth: number;
}

const formatCodeLine = ({
  lineNum,
  content,
  isError,
  lineNumWidth,
}: FormatCodeLineInput): string => {
  const marker = getMarker(isError);
  const lineNumStr = String(lineNum).padStart(lineNumWidth, ' ');
  // WHY: source lines are raw template text — strip controls BEFORE highlighting so
  // the sanitizer never touches the structured ANSI the highlighter produces.
  const sanitized = sanitizeTerminalText(content);
  const highlighted = isError ? highlightAnsi(sanitized) : picocolors.dim(highlightAnsi(sanitized));
  return `${marker}${picocolors.dim(lineNumStr)}${picocolors.dim(SEPARATOR)}${highlighted}`;
};

const getLinePrefix = (lineNumWidth: number): string =>
  picocolors.dim(`${NORMAL_MARKER}${' '.repeat(lineNumWidth)}${SEPARATOR}`);

interface FormatCaretLineInput {
  lineNumWidth: number;
  displayStart: number;
  carets: string;
}

const formatCaretLine = ({ lineNumWidth, displayStart, carets }: FormatCaretLineInput): string => {
  const prefix = getLinePrefix(lineNumWidth);
  return `${prefix}${' '.repeat(displayStart)}${picocolors.red(carets)}`;
};

/**
 * Formats source-trace lines for ANSI output with aligned line-number gutters, `> `
 * error markers, and a red caret line directly under the offending token; non-error
 * lines are dimmed.
 */
const formatSourceTrace = (lines: SourceTraceLine[], caret: SourceTraceCaret | null): string[] => {
  if (lines.length === 0) {
    return [];
  }

  const lineNumWidth = getLineNumWidth(lines);

  return lines.flatMap((line) => {
    const codeLine = formatCodeLine({
      lineNum: line.number,
      content: line.content,
      isError: line.isError,
      lineNumWidth,
    });
    if (!(line.isError && caret)) {
      return [codeLine];
    }
    return [
      codeLine,
      formatCaretLine({ lineNumWidth, displayStart: caret.displayStart, carets: caret.carets }),
    ];
  });
};
