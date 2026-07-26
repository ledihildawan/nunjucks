import { escapeHtml } from './escape.ts';

export type HtmlContext = 'html' | 'attribute' | 'script' | 'style' | 'comment';

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

export { escapeHtml };

export const escapeAttribute = (str: string): string => {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i]!;
    result += ESCAPE_ATTRIBUTE.get(char) ?? char;
  }
  return result;
};

export const escapeScriptString = (str: string): string => {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i]!;
    result += ESCAPE_SCRIPT_STRING.get(char) ?? char;
  }
  return result;
};

export const escapeStyle = (str: string): string => {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i]!;
    result += ESCAPE_STYLE.get(char) ?? char;
  }
  return result;
};

export const escapeForContext = (str: string, context: HtmlContext): string => {
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

// Both helpers take a fresh /g/ literal from the call site, so resetting
// lastIndex is belt-and-braces rather than load-bearing.
const lastMatchEnd = (re: RegExp, text: string): number => {
  let last = -1;
  let match: RegExpExecArray | null = re.exec(text);
  while (match !== null) {
    last = match.index + match[0]!.length;
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

  const openTagMatch = /<[a-zA-Z][a-zA-Z0-9]*(?:\s+[^>]*)?$/i.exec(before);
  if (!openTagMatch) { return 'html'; }

  const openTagContent = before.slice(openTagMatch.index);

  if (!openTagContent.includes('=')) { return 'html'; }

  const equalsMatch = /[=][\s]*["']?/.exec(openTagContent);
  if (!equalsMatch) { return 'html'; }

  const afterEquals = openTagContent.slice(equalsMatch.index + equalsMatch[0]!.length);

  if (/^["'`][^"'`]*["'`]/.test(afterEquals)) {
    return 'attribute';
  }

  const firstCharAfterEquals = afterEquals.trimStart()[0];
  if (firstCharAfterEquals && !['<', '>', '/'].includes(firstCharAfterEquals)) {
    return 'attribute';
  }

  return 'html';
};

const contextBefore = (before: string): HtmlContext =>
  detectAttributeContext(before, scanScriptStyleContext(before));

export interface HtmlContextTracker {
  getContextAtLineCol: (lineno: number, colno: number) => HtmlContext;
  getContextAt: (offset: number) => HtmlContext;
}

export const createHtmlContextTracker = (source: string): HtmlContextTracker => {
  const lines = source.split('\n');
  const lineOffsets = [0];
  for (let i = 0; i < lines.length - 1; i++) {
    lineOffsets.push(lineOffsets[i]! + lines[i]!.length + 1);
  }

  const offsetOf = (lineno: number, colno: number): number => {
    if (lineno < 0 || lineno >= lineOffsets.length) {
      return 0;
    }
    return lineOffsets[lineno]! + colno;
  };

  return {
    getContextAtLineCol: (lineno, colno) => contextBefore(source.slice(0, offsetOf(lineno, colno))),
    getContextAt: offset => contextBefore(source.slice(0, offset)),
  };
};

export function detectHtmlContext(source: string, position: number): HtmlContext {
  return createHtmlContextTracker(source).getContextAt(position);
}

export function getContextAtLineCol(source: string, lineno: number, colno: number): HtmlContext {
  return createHtmlContextTracker(source).getContextAtLineCol(lineno, colno);
}
