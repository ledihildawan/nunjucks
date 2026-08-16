import {
  escapeAttribute,
  escapeHtml,
  escapeScriptString,
  escapeStyle,
  escapeUnquotedAttribute,
} from '@nunjucks/lib/escape';

type HtmlContext = 'html' | 'attribute' | 'unquoted-attribute' | 'script' | 'style' | 'comment';

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
      return str.replaceAll('-->', '--&gt;');
    default:
      return escapeHtml(str);
  }
};

interface ScriptStyleScan {
  context: HtmlContext;
  lastOpen: number;
  lastClose: number;
}

const UNCLOSED_OPEN_TAG_RE = /<[a-zA-Z][a-zA-Z0-9]*(?:\s+[^>]*)?$/i;
// WHY: must NOT consume the opening quote — afterEquals has to start at the delimiter so
// the quote check below can distinguish quoted from unquoted values.
const ATTRIBUTE_EQUALS_RE = /[=][\s]*/;
const QUOTE_CHARS = ['"', "'", '`'];

const lastMatch = (re: RegExp, text: string): RegExpExecArray | undefined => {
  const matches = [...text.matchAll(re)];
  return matches[matches.length - 1];
};

const lastMatchEnd = (re: RegExp, text: string): number => {
  const matchResult = lastMatch(re, text);
  return matchResult ? matchResult.index + (matchResult[0]?.length ?? 0) : -1;
};

const lastMatchStart = (re: RegExp, text: string): number => {
  const matchResult = lastMatch(re, text);
  return matchResult ? matchResult.index : -1;
};

const scanScriptStyleContext = (before: string): ScriptStyleScan => {
  const scriptOpen = lastMatchEnd(/<script[\s>]/gi, before);
  const scriptClose = lastMatchStart(/<\/script\s*>/gi, before);
  const styleOpen = lastMatchEnd(/<style[\s>]/gi, before);
  const styleClose = lastMatchStart(/<\/style\s*>/gi, before);

  if (scriptOpen > scriptClose && scriptOpen > styleOpen && scriptOpen > styleClose) {
    return { context: 'script', lastOpen: scriptOpen, lastClose: scriptClose };
  }
  if (styleOpen > styleClose && styleOpen >= scriptOpen && styleOpen > scriptClose) {
    return { context: 'style', lastOpen: styleOpen, lastClose: styleClose };
  }
  return { context: 'html', lastOpen: -1, lastClose: -1 };
};

const detectAttributeContext = (
  before: string,
  scriptStyleResult: ScriptStyleScan
): HtmlContext => {
  if (scriptStyleResult.context !== 'html') {
    return scriptStyleResult.context;
  }

  const openTagMatch = UNCLOSED_OPEN_TAG_RE.exec(before);
  if (!openTagMatch) {
    return 'html';
  }

  const openTagContent = before.slice(openTagMatch.index);

  if (!openTagContent.includes('=')) {
    return 'html';
  }

  const equalsMatch = ATTRIBUTE_EQUALS_RE.exec(openTagContent);
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

const contextBefore = (before: string): HtmlContext =>
  detectAttributeContext(before, scanScriptStyleContext(before));

interface HtmlContextTracker {
  getContextAtLineCol: (lineno: number, colno: number) => HtmlContext;
  getContextAt: (offset: number) => HtmlContext;
}

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
    getContextAtLineCol: (line, col) => contextBefore(source.slice(0, offsetOf(line, col))),
    getContextAt: (at) => contextBefore(source.slice(0, at)),
  };
};

export type { HtmlContext };
export {
  createHtmlContextTracker,
  escapeAttribute,
  escapeForContext,
  escapeScriptString,
  escapeStyle,
};
