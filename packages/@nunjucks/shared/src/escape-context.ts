import { escapeHtml } from './escape.ts';

type HtmlContext = 'html' | 'attribute' | 'script' | 'style' | 'comment';

const ESCAPE_ATTRIBUTE: ReadonlyMap<string, string> = Object.freeze(new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;'],
  ['`', '&#96;'],
]));

const ESCAPE_SCRIPT_STRING: ReadonlyMap<string, string> = Object.freeze(new Map([
  ['\\', '\\\\'],
  ['"', '\\"'],
  ["'", "\\'"],
  ['\n', '\\n'],
  ['\r', '\\r'],
  ['\t', '\\t'],
  ['</', '<\\/'],
  ['<', '\\u003c'],
  ['>', '\\u003e'],
]));

const ESCAPE_STYLE: ReadonlyMap<string, string> = Object.freeze(new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;'],
]));

const escapeWith = (map: ReadonlyMap<string, string>) => (str: string): string =>
  Array.from(str, char => map.get(char) ?? char).join('');

const escapeAttribute = escapeWith(ESCAPE_ATTRIBUTE);
const escapeScriptString = escapeWith(ESCAPE_SCRIPT_STRING);
const escapeStyle = escapeWith(ESCAPE_STYLE);

const escapeForContext = (str: string, context: HtmlContext): string => {
  switch (context) {
    case 'html':
      return escapeHtml(str);
    case 'attribute':
      return escapeAttribute(str);
    case 'script':
      return escapeScriptString(str);
    case 'style':
      return escapeStyle(str);
    case 'comment':
      return str.replace(/-->/g, '--&gt;');
    default:
      return escapeHtml(str);
  }
};

interface ScriptStyleScan {
  context: HtmlContext;
  lastOpen: number;
  lastClose: number;
}

// Hoisted so each pattern is compiled once rather than on every lookup.
const UNCLOSED_OPEN_TAG_RE = /<[a-zA-Z][a-zA-Z0-9]*(?:\s+[^>]*)?$/i;
const ATTRIBUTE_EQUALS_RE = /[=][\s]*["']?/;
const QUOTED_ATTRIBUTE_VALUE_RE = /^["'`][^"'`]*["'`]/;

// Both helpers take a fresh /g/ literal from the call site, so resetting
// lastIndex is belt-and-braces rather than load-bearing.
const lastMatchEnd = (re: RegExp, text: string): number => {
  let last = -1;
  let match: RegExpExecArray | null = re.exec(text);
  while (match !== null) {
    last = match.index + (match[0]?.length ?? 0);
    match = re.exec(text);
  }
  re.lastIndex = 0;
  return last;
};

const lastMatchStart = (re: RegExp, text: string): number => {
  let last = -1;
  let match: RegExpExecArray | null = re.exec(text);
  while (match !== null) {
    last = match.index;
    match = re.exec(text);
  }
  re.lastIndex = 0;
  return last;
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

const detectAttributeContext = (before: string, scriptStyleResult: ScriptStyleScan): HtmlContext => {
  if (scriptStyleResult.context !== 'html') {
    return scriptStyleResult.context;
  }

  const openTagMatch = UNCLOSED_OPEN_TAG_RE.exec(before);
  if (!openTagMatch) { return 'html'; }

  const openTagContent = before.slice(openTagMatch.index);

  if (!openTagContent.includes('=')) { return 'html'; }

  const equalsMatch = ATTRIBUTE_EQUALS_RE.exec(openTagContent);
  if (!equalsMatch) { return 'html'; }

  const afterEquals = openTagContent.slice(equalsMatch.index + (equalsMatch[0]?.length ?? 0));

  if (QUOTED_ATTRIBUTE_VALUE_RE.test(afterEquals)) {
    return 'attribute';
  }

  const [firstCharAfterEquals] = afterEquals.trimStart();
  if (firstCharAfterEquals && !['<', '>', '/'].includes(firstCharAfterEquals)) {
    return 'attribute';
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
    (acc, line) => { acc.push((acc[acc.length - 1] ?? 0) + line.length + 1); return acc; },
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
    getContextAt: at => contextBefore(source.slice(0, at)),
  };
};

export { escapeAttribute, escapeScriptString, escapeStyle, escapeForContext, createHtmlContextTracker };
export type { HtmlContext, HtmlContextTracker };

export { escapeHtml } from './escape.ts';
