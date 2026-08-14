import { escapeHtml } from '@nunjucks/lib/escape';
import picocolors from 'picocolors';

const LEADING_WHITESPACE_RE = /^\s+/u;
const PLAIN_RUN_RE = /^[^<{}"'|\s]+/u;

const renderInlineMarkdown = (text: string): string => {
  if (!text) { return ''; }
  return escapeHtml(text)
    .replaceAll(/`([^`]+)`/gu, '<code class="md-code">$1</code>')
    .replaceAll(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>');
};

interface SyntaxRule {
  type: string;
  re: RegExp;
  tagOnly?: boolean;
  toggle?: boolean;
}

const SYNTAX_RULES: SyntaxRule[] = [
  { type: 'comment', re: /^\{#[\s\S]*?#\}/u },
  { type: 'tag', re: /^<\/?[a-zA-Z][\w-]*/u },
  { type: 'delimiter', re: /^(?:\{\{|\}\}|\{%|%\})/u, toggle: true },
  { type: 'pipe', re: /^\|>/u },
  { type: 'string', re: /^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/u },
  { type: 'number', re: /^\d+(?:\.\d+)?/u },
  { type: 'attr', re: /^[a-zA-Z_][\w-]*(?=\s*=)/u },
  {
    type: 'keyword',
    re: /^(?:endraw|raw|endfilter|filter|endcomponent|component|endrender|render|endslot|slot|endblock|block|endfor|for|endif|elif|else|if|extends|include|import|from|set|with|without|context|as|not|and|or|in|is|true|false|none|null)(?![\w-])/u,
    tagOnly: true,
  },
  { type: 'variable', re: /^[a-zA-Z_]\w*/u, tagOnly: true },
  { type: 'operator', re: /^(?:\||=|==|!=|<=|>=|<|>|\+|-|\*|\/|%|&|\[|\]|\(|\)|\.|,|:|\?)/u },
];

const span = (type: string, text: string): string =>
  `<span class="syntax-${type}">${escapeHtml(text)}</span>`;

interface HighlightChunk {
  html: string;
  length: number;
  inTag: boolean;
}

const matchHtmlRule = (rules: SyntaxRule[], rest: string, inTag: boolean): HighlightChunk | null => {
  if (rules.length === 0) { return null; }
  const rule = rules[0];
  if (!rule) { return null; }
  const matched = rest.match(rule.re)?.[0];
  if (matched) {
    const nextInTag = rule.toggle ? (matched === '{{' || matched === '{%') : inTag;
    return { html: span(rule.type, matched), length: matched.length, inTag: nextInTag };
  }
  return matchHtmlRule(rules.slice(1), rest, inTag);
};

const nextHtmlChunk = (rest: string, inTag: boolean): HighlightChunk => {
  const ws = rest.match(LEADING_WHITESPACE_RE)?.[0];
  if (ws) { return { html: ws, length: ws.length, inTag }; }

  const applicableRules = SYNTAX_RULES.filter(r => !r.tagOnly || inTag);
  const matched = matchHtmlRule(applicableRules, rest, inTag);
  if (matched) { return matched; }

  const plain = rest.match(PLAIN_RUN_RE)?.[0];
  if (plain) { return { html: escapeHtml(plain), length: plain.length, inTag }; }

  return { html: escapeHtml(rest[0] ?? ''), length: 1, inTag };
};

const highlightHtml = (code: string): string => {
  if (!code) { return ''; }
  const loop = (i: number, out: string, inTag: boolean): string => {
    if (i >= code.length) { return out; }
    const chunk = nextHtmlChunk(code.slice(i), inTag);
    return loop(i + chunk.length, out + chunk.html, chunk.inTag);
  };
  return loop(0, '', false);
};

const JS_RULES: SyntaxRule[] = [
  { type: 'comment', re: /^\/\/[^\n]*/u },
  { type: 'comment', re: /^\/\*[\s\S]*?\*\//u },
  { type: 'string', re: /^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/u },
  { type: 'number', re: /^\d+(?:\.\d+)?/u },
  {
    type: 'keyword',
    re: /^(?:function|async|await|try|catch|finally|return|const|let|var|new|throw|typeof|void|delete|class|extends|super|import|export|default|yield|if|else|for|while|do|switch|case|break|continue|this|of|in|instanceof)(?![\w$])/u,
  },
  { type: 'variable', re: /^[a-zA-Z_$][\w$]*/u },
  { type: 'operator', re: /^(?:=>|==|!=|<=|>=|&&|\|\||<|>|\+|-|\*|\/|%|&|\||\^|!|=|\?|:|;|,|\.|\(|\)|\[|\]|\{|\})/u },
];

const matchJsRule = (rules: SyntaxRule[], rest: string): HighlightChunk | null => {
  if (rules.length === 0) { return null; }
  const rule = rules[0];
  if (!rule) { return null; }
  const matched = rest.match(rule.re)?.[0];
  if (matched) { return { html: span(rule.type, matched), length: matched.length, inTag: false }; }
  return matchJsRule(rules.slice(1), rest);
};

const nextJsChunk = (rest: string): HighlightChunk => {
  const ws = rest.match(LEADING_WHITESPACE_RE)?.[0];
  if (ws) { return { html: ws, length: ws.length, inTag: false }; }

  const matched = matchJsRule(JS_RULES, rest);
  if (matched) { return matched; }

  return { html: escapeHtml(rest[0] ?? ''), length: 1, inTag: false };
};

const highlightJs = (code: string): string => {
  if (!code) { return ''; }
  const loop = (i: number, out: string): string => {
    if (i >= code.length) { return out; }
    const chunk = nextJsChunk(code.slice(i));
    return loop(i + chunk.length, out + chunk.html);
  };
  return loop(0, '');
};

// WHY: ANSI syntax coloring — mirrors the HTML tokenizer (SYNTAX_RULES + inTag toggle) but outputs picocolors terminal colors instead of HTML spans. Color scheme matches the HTML CSS (tag=red, delimiter=cyan, string=green, keyword=magenta, etc.) so ANSI and HTML output look consistent.
const ANSI_COLOR_MAP: Record<string, ((text: string) => string) | undefined> = {
  comment: (text) => picocolors.dim(picocolors.italic(text)),
  tag: (text) => picocolors.red(text),
  attr: (text) => picocolors.green(text),
  delimiter: (text) => picocolors.cyan(picocolors.bold(text)),
  pipe: (text) => picocolors.cyan(picocolors.bold(text)),
  string: (text) => picocolors.green(text),
  number: (text) => picocolors.yellow(text),
  keyword: (text) => picocolors.magenta(picocolors.bold(text)),
  variable: (text) => text,
  operator: (text) => picocolors.gray(text),
};

const colorize = (type: string, text: string): string =>
  (ANSI_COLOR_MAP[type] ?? ((t: string) => t))(text);

interface AnsiChunk {
  text: string;
  length: number;
  inTag: boolean;
}

const matchAnsiRule = (rules: readonly SyntaxRule[], rest: string, inTag: boolean): AnsiChunk | null => {
  if (rules.length === 0) { return null; }
  const rule = rules[0];
  if (!rule) { return null; }
  const matched = rest.match(rule.re)?.[0];
  if (matched) {
    const nextInTag = rule.toggle ? (matched === '{{' || matched === '{%') : inTag;
    return { text: colorize(rule.type, matched), length: matched.length, inTag: nextInTag };
  }
  return matchAnsiRule(rules.slice(1), rest, inTag);
};

const nextAnsiChunk = (rest: string, inTag: boolean): AnsiChunk => {
  const ws = rest.match(LEADING_WHITESPACE_RE)?.[0];
  if (ws) { return { text: ws, length: ws.length, inTag }; }

  const applicableRules = SYNTAX_RULES.filter(r => !r.tagOnly || inTag);
  const matched = matchAnsiRule(applicableRules, rest, inTag);
  if (matched) { return matched; }

  const plain = rest.match(PLAIN_RUN_RE)?.[0];
  if (plain) { return { text: plain, length: plain.length, inTag }; }

  return { text: rest[0] ?? '', length: 1, inTag };
};

const highlightAnsi = (code: string): string => {
  if (!code) { return ''; }
  const loop = (i: number, out: string, inTag: boolean): string => {
    if (i >= code.length) { return out; }
    const chunk = nextAnsiChunk(code.slice(i), inTag);
    return loop(i + chunk.length, out + chunk.text, chunk.inTag);
  };
  return loop(0, '', false);
};

export { escapeHtml, escapeAttribute } from '@nunjucks/lib/escape';
export { renderInlineMarkdown, highlightHtml, highlightJs, highlightAnsi };
