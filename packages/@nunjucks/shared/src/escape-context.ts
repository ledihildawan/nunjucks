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

const SCRIPT_OPEN_RE = /<script[\s>]/i;
const SCRIPT_CLOSE_RE = /<\/script\s*>/i;
const STYLE_OPEN_RE = /<style[\s>]/i;
const STYLE_CLOSE_RE = /<\/style\s*>/i;

export class HtmlContextTracker {
  private source: string;
  private lines: string[];
  private lineOffsets: number[] = [];

  constructor(source: string) {
    this.source = source;
    this.lines = source.split('\n');
    this.lineOffsets = [0];
    for (let i = 0; i < this.lines.length - 1; i++) {
      this.lineOffsets.push(this.lineOffsets[i]! + this.lines[i]!.length + 1);
    }
  }

  private getOffset(lineno: number, colno: number): number {
    if (lineno < 0 || lineno >= this.lineOffsets.length) {
      return 0;
    }
    return this.lineOffsets[lineno]! + colno;
  }

  private scanScriptStyleContext(before: string): { context: HtmlContext; lastOpen: number; lastClose: number } {
    let lastScriptOpen = -1;
    let lastScriptClose = -1;
    let lastStyleOpen = -1;
    let lastStyleClose = -1;

    let match;
    const scriptOpenRe = /<script[\s>]/gi;
    const scriptCloseRe = /<\/script\s*>/gi;
    const styleOpenRe = /<style[\s>]/gi;
    const styleCloseRe = /<\/style\s*>/gi;

    while ((match = scriptOpenRe.exec(before)) !== null) {
      lastScriptOpen = match.index + match[0]!.length;
    }
    scriptOpenRe.lastIndex = 0;
    while ((match = scriptCloseRe.exec(before)) !== null) {
      lastScriptClose = match.index;
    }
    scriptCloseRe.lastIndex = 0;
    while ((match = styleOpenRe.exec(before)) !== null) {
      lastStyleOpen = match.index + match[0]!.length;
    }
    styleOpenRe.lastIndex = 0;
    while ((match = styleCloseRe.exec(before)) !== null) {
      lastStyleClose = match.index;
    }
    styleCloseRe.lastIndex = 0;

    const inScript = lastScriptOpen > lastScriptClose && lastScriptOpen > lastStyleOpen && lastScriptOpen > lastStyleClose;
    const inStyle = lastStyleOpen > lastStyleClose && lastStyleOpen >= lastScriptOpen && lastStyleOpen > lastScriptClose;

    if (inScript) return { context: 'script', lastOpen: lastScriptOpen, lastClose: lastScriptClose };
    if (inStyle) return { context: 'style', lastOpen: lastStyleOpen, lastClose: lastStyleClose };
    return { context: 'html', lastOpen: -1, lastClose: -1 };
  }

  private detectAttributeContext(before: string, scriptStyleResult: { context: HtmlContext; lastOpen: number; lastClose: number }): HtmlContext {
    if (scriptStyleResult.context !== 'html') {
      return scriptStyleResult.context;
    }

    const openTagMatch = /<[a-zA-Z][a-zA-Z0-9]*(?:\s+[^>]*)?$/i.exec(before);
    if (!openTagMatch) return 'html';

    const openTagStart = openTagMatch.index;
    const openTagContent = before.slice(openTagStart);
    
    if (!openTagContent.includes('=')) return 'html';

    const equalsMatch = /=[\s]*["']?/.exec(openTagContent);
    if (!equalsMatch) return 'html';

    const equalsPos = equalsMatch.index + equalsMatch[0]!.length;
    const beforeEquals = openTagContent.slice(0, equalsMatch.index);
    const afterEquals = openTagContent.slice(equalsPos);

    const closeQuoteMatch = afterEquals.match(/^["'`][^"'`]*["'`]/);
    if (closeQuoteMatch) {
      return 'attribute';
    }

    const firstCharAfterEquals = afterEquals.trimStart()[0];
    if (firstCharAfterEquals && !['<', '>', '/'].includes(firstCharAfterEquals)) {
      return 'attribute';
    }

    return 'html';
  }

  getContextAtLineCol(lineno: number, colno: number): HtmlContext {
    const offset = this.getOffset(lineno, colno);
    const before = this.source.slice(0, offset);
    
    const scriptStyleResult = this.scanScriptStyleContext(before);
    return this.detectAttributeContext(before, scriptStyleResult);
  }

  getContextAt(offset: number): HtmlContext {
    const before = this.source.slice(0, offset);
    
    const scriptStyleResult = this.scanScriptStyleContext(before);
    return this.detectAttributeContext(before, scriptStyleResult);
  }
}

export function detectHtmlContext(source: string, position: number): HtmlContext {
  const tracker = new HtmlContextTracker(source);
  return tracker.getContextAt(position);
}

export function getContextAtLineCol(source: string, lineno: number, colno: number): HtmlContext {
  const tracker = new HtmlContextTracker(source);
  return tracker.getContextAtLineCol(lineno, colno);
}
