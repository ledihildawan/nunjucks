import {
  escapeAttribute,
  escapeHtml,
  escapeScriptString,
  escapeStyle,
  escapeUnquotedAttribute,
} from './escape.ts';

/**
 * The output context a value is being interpolated into, governing its escaper.
 * @type {'html' | 'attribute' | 'unquoted-attribute' | 'script' | 'style' | 'comment'}
 */
type HtmlContext = 'html' | 'attribute' | 'unquoted-attribute' | 'script' | 'style' | 'comment';

/**
 * Escapes a string for one `HtmlContext`, dispatching to the lib escapers and
 * neutering both comment abrupt-close sequences (`-->` and the legacy `--!>`)
 * that plain HTML escaping leaves exploitable.
 */
const escapeForContext = (str: string, context: HtmlContext): string => {
  switch (context) {
    case 'html':
      return escapeHtml(str);
    case 'attribute':
      return escapeAttribute(str);
    case 'unquoted-attribute':
      // WHY: quoted vs unquoted differ fundamentally — an unquoted value has no delimiter,
      // so whitespace/`=` must be percent-encoded (see lib/escape escapeUnquotedAttribute).
      return escapeUnquotedAttribute(str);
    case 'script':
      return escapeScriptString(str);
    case 'style':
      return escapeStyle(str);
    case 'comment':
      // WHY: both HTML-spec abrupt-close sequences terminate comments — `-->` and the
      // legacy `--!>`; escaping only the first leaves the second as a comment breakout.
      // The rest of the payload stays verbatim: `<`/`&` are inert inside comment bodies.
      return str.replaceAll('-->', '--&gt;').replaceAll('--!>', '--!&gt;');
    default:
      return escapeHtml(str);
  }
};

const SCRIPT_OPEN_RE = /<script[\s>]/gi;
const SCRIPT_CLOSE_RE = /<\/script\s*>/gi;
const STYLE_OPEN_RE = /<style[\s>]/gi;
const STYLE_CLOSE_RE = /<\/style\s*>/gi;
const COMMENT_OPEN_RE = /<!--/g;
const COMMENT_CLOSE_RE = /-->/g;
const UNCLOSED_OPEN_TAG_RE = /<[a-zA-Z][a-zA-Z0-9]*(?:\s+[^>]*)?$/i;
// WHY: global — the LAST `=` in the open tag governs the pending interpolation, not
// the first. With `<a class="btn" href={{v}}` the first `=` belongs to `class`;
// selecting it misclassifies the unquoted `href` value as quoted (XSS breakout:
// `escapeAttribute` does not encode spaces/`=`), and the reverse shape
// (`<div class={{v}} title="{{t}}`) percent-encodes a quoted value. The residual
// edge (an `=` inside an earlier quoted value, e.g. `title="x=y" href={{u}}`)
// resolves to the wrong `=` only when the interpolation precedes that attribute —
// and the failure mode is the stricter unquoted escaping, so it fails closed.
const ATTRIBUTE_EQUALS_RE = /[=][\s]*/g;
const QUOTE_CHARS = ['"', "'", '`'];

// WHY: last-match lookup runs a bounded exec loop over the full source instead of
// slicing the prefix and materializing every match ([...matchAll]) only to keep the
// last one — zero string copies, zero intermediate arrays per interpolation site.
// Module-level /g regexes with an explicit lastIndex reset keep the scan reusable.
const lastMatch = (re: RegExp, text: string): RegExpExecArray | undefined => {
  re.lastIndex = 0;
  let found: RegExpExecArray | undefined;
  for (let match = re.exec(text); match !== null; match = re.exec(text)) {
    found = match;
  }
  return found;
};

const lastMatchEndBefore = (re: RegExp, source: string, bound: number): number => {
  re.lastIndex = 0;
  let last = -1;
  let match = re.exec(source);
  while (match !== null) {
    const end = match.index + match[0].length;
    // WHY: /g matches advance monotonically — once one ends past the bound, no later
    // match can precede it, so the walk stops early.
    if (end > bound) {
      break;
    }
    last = end;
    match = re.exec(source);
  }
  return last;
};

const lastMatchStartBefore = (re: RegExp, source: string, bound: number): number => {
  re.lastIndex = 0;
  let last = -1;
  let match = re.exec(source);
  while (match !== null) {
    const end = match.index + match[0].length;
    if (end > bound) {
      break;
    }
    last = match.index;
    match = re.exec(source);
  }
  return last;
};

const scanScriptStyleContext = (source: string, bound: number): HtmlContext => {
  const scriptOpen = lastMatchEndBefore(SCRIPT_OPEN_RE, source, bound);
  const scriptClose = lastMatchStartBefore(SCRIPT_CLOSE_RE, source, bound);
  const styleOpen = lastMatchEndBefore(STYLE_OPEN_RE, source, bound);
  const styleClose = lastMatchStartBefore(STYLE_CLOSE_RE, source, bound);
  const commentOpen = lastMatchEndBefore(COMMENT_OPEN_RE, source, bound);
  const commentClose = lastMatchStartBefore(COMMENT_CLOSE_RE, source, bound);

  if (scriptOpen > scriptClose && scriptOpen > styleOpen && scriptOpen > styleClose) {
    return 'script';
  }
  if (styleOpen > scriptClose && styleOpen > styleClose && styleOpen >= scriptOpen) {
    return 'style';
  }
  // WHY: an unclosed `<!--` governs interpolations inside comment bodies — they need
  // the comment escaper (both abrupt-close sequences) instead of plain escapeHtml.
  if (commentOpen > commentClose) {
    return 'comment';
  }
  return 'html';
};

const detectAttributeContext = (
  source: string,
  bound: number,
  scriptStyleContext: HtmlContext
): HtmlContext => {
  if (scriptStyleContext !== 'html') {
    return scriptStyleContext;
  }

  // WHY: an open tag cannot contain `>`, so the pending open tag always starts after
  // the last `>` before the interpolation — scanning only that window reproduces the
  // previous whole-prefix anchored scan at a fraction of the cost.
  const windowStart = source.lastIndexOf('>', bound - 1) + 1;
  const window = source.slice(windowStart, bound);

  const openTagMatch = UNCLOSED_OPEN_TAG_RE.exec(window);
  if (!openTagMatch) {
    return 'html';
  }

  const openTagContent = window.slice(openTagMatch.index);

  if (!openTagContent.includes('=')) {
    return 'html';
  }

  const equalsMatch = lastMatch(ATTRIBUTE_EQUALS_RE, openTagContent);
  if (!equalsMatch) {
    return 'html';
  }

  const afterEquals = openTagContent.slice(equalsMatch.index + (equalsMatch[0]?.length ?? 0));

  // WHY: only the PREFIX before an interpolation is visible at detection time, so a
  // closing quote can never be matched here — the opening quote alone decides. An opening
  // quote means the value is delimited (entity-escaping suffices); anything else after a
  // bare `=` is an unquoted value needing percent-encoding (see escapeUnquotedAttribute).
  const [valueDelimiter] = afterEquals;
  if (valueDelimiter && QUOTE_CHARS.includes(valueDelimiter)) {
    return 'attribute';
  }

  const [firstCharAfterEquals] = afterEquals.trimStart();
  if (firstCharAfterEquals && !['<', '>', '/'].includes(firstCharAfterEquals)) {
    return 'unquoted-attribute';
  }

  return 'html';
};

const contextBefore = (source: string, bound: number): HtmlContext =>
  detectAttributeContext(source, bound, scanScriptStyleContext(source, bound));

interface HtmlContextTracker {
  getContextAtLineCol: (lineno: number, colno: number) => HtmlContext;
  getContextAt: (offset: number) => HtmlContext;
}

/**
 * Creates a tracker that classifies the `HtmlContext` at any source offset by
 * scanning only up to that offset — script/style/comment nesting plus the
 * pending open tag's attribute position — so escaping matches the spot the
 * interpolation lands in.
 * @param source - The template source string to analyze
 * @returns An HtmlContextTracker with methods to query context at positions
 */
const createHtmlContextTracker = (source: string): HtmlContextTracker => {
  const lines = source.split('\n');
  const lineOffsets: number[] = lines.slice(0, -1).reduce<number[]>(
    (acc, line) => {
      acc.push((acc.at(-1) ?? 0) + line.length + 1);
      return acc;
    },
    [0]
  );

  const offsetOf = (lineno: number, colno: number): number => {
    const lineStart = lineOffsets[lineno];
    if (lineStart === undefined) {
      return 0;
    }
    return lineStart + colno;
  };

  return {
    getContextAtLineCol: (line, col) => contextBefore(source, offsetOf(line, col)),
    getContextAt: (at) => contextBefore(source, at),
  };
};

export type { HtmlContext };
export { createHtmlContextTracker, escapeForContext };
