import { escapeHtml } from './escape.ts';

type HtmlContext = 'html' | 'attribute' | 'script' | 'style' | 'comment';

const escapeAttribute = (str: string): string => str
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll('\'', '&#39;')
  .replaceAll('`', '&#96;');

const escapeScriptString = (str: string): string => str
  .replaceAll('\\', '\\\\')
  .replaceAll('"', '\\"')
  .replaceAll('\'', "\\'")
  .replaceAll('\n', '\\n')
  .replaceAll('\r', '\\r')
  .replaceAll('\t', '\\t')
  .replaceAll('<', '\\u003c')
  .replaceAll('>', '\\u003e');

const escapeStyle = (str: string): string => str
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll('\'', '&#39;');

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
const ATTRIBUTE_EQUALS_RE = /[=][\s]*["']?/;
const QUOTED_ATTRIBUTE_VALUE_RE = /^["'`][^"'`]*["'`]/;

const lastMatch = (re: RegExp, text: string): RegExpExecArray | undefined => {
  const matches = [...text.matchAll(re)];
  return matches[matches.length - 1];
};

const lastMatchEnd = (re: RegExp, text: string): number => {
  const m = lastMatch(re, text);
  return m ? m.index + (m[0]?.length ?? 0) : -1;
};

const lastMatchStart = (re: RegExp, text: string): number => {
  const m = lastMatch(re, text);
  return m ? m.index : -1;
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
    (acc, line) => { acc.push((acc.at(-1) ?? 0) + line.length + 1); return acc; },
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
export type { HtmlContext };