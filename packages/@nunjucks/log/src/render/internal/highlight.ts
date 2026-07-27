import { escapeHtml } from '@nunjucks/shared';

// Hoisted so each pattern is compiled once rather than on every token.
const LEADING_WHITESPACE_RE = /^\s+/u;
const PLAIN_RUN_RE = /^[^<{}"'|\s]+/u;

const renderInlineMarkdown = (text: string): string => {
  if (!text) { return ''; }
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/gu, '<code class="md-code">$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>');
  return s;
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
    re: /^(?:endraw|raw|endfilter|filter|endcall|call|endmacro|macro|endblock|block|endfor|for|endif|elif|else|if|extends|include|import|from|set|with|without|context|as|not|and|or|in|is|true|false|none|null)(?![\w-])/u,
    tagOnly: true,
  },
  { type: 'variable', re: /^[a-zA-Z_]\w*/u, tagOnly: true },
  { type: 'operator', re: /^(?:\||=|==|!=|<=|>=|<|>|\+|-|\*|\/|%|&|\[|\]|\(|\)|\.|,|:|\?)/u },
];

const span = (type: string, text: string): string =>
  `<span class="syntax-${type}">${escapeHtml(text)}</span>`;

/** One highlighted chunk, plus how far it advances and the tag state after it. */
interface HighlightChunk {
  html: string;
  length: number;
  inTag: boolean;
}

/**
 * Consume one chunk from the start of `rest`: leading whitespace, then the
 * first matching syntax rule, then a plain run, then a single character. The
 * cases are returns rather than a loop with guards, so the scanner below is a
 * plain accumulate.
 */
const nextHtmlChunk = (rest: string, inTag: boolean): HighlightChunk => {
  const ws = rest.match(LEADING_WHITESPACE_RE)?.[0];
  if (ws) { return { html: ws, length: ws.length, inTag }; }

  // `inTag` only changes on the chunk that returns, so filtering on it once is
  // equivalent to testing it per rule.
  for (const rule of SYNTAX_RULES.filter(r => !r.tagOnly || inTag)) {
    const matched = rest.match(rule.re)?.[0];
    if (!matched) { continue; }
    let nextInTag = inTag;
    if (rule.toggle) { nextInTag = matched === '{{' || matched === '{%'; }
    return { html: span(rule.type, matched), length: matched.length, inTag: nextInTag };
  }

  const plain = rest.match(PLAIN_RUN_RE)?.[0];
  if (plain) { return { html: escapeHtml(plain), length: plain.length, inTag }; }

  return { html: escapeHtml(rest[0] ?? ''), length: 1, inTag };
};

const highlightHtml = (code: string): string => {
  if (!code) { return ''; }
  let out = '';
  let i = 0;
  let inTag = false;
  while (i < code.length) {
    const chunk = nextHtmlChunk(code.slice(i), inTag);
    out += chunk.html;
    i += chunk.length;
    inTag = chunk.inTag;
  }
  return out;
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

const highlightJs = (code: string): string => {
  if (!code) { return ''; }
  let out = '';
  let i = 0;
  const span = (type: string, text: string) => `<span class="syntax-${type}">${escapeHtml(text)}</span>`;
  while (i < code.length) {
    const rest = code.slice(i);
    const ws = rest.match(LEADING_WHITESPACE_RE);
    if (ws) { out += ws[0]; i += ws[0].length; continue; }
    let matched = false;
    for (const rule of JS_RULES) {
      const m = rest.match(rule.re);
      if (m?.[0]) {
        out += span(rule.type, m[0]);
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) { out += escapeHtml(code[i] ?? ''); i += 1; }
  }
  return out;
};

export { escapeHtml } from '@nunjucks/shared';
export { renderInlineMarkdown, highlightHtml, highlightJs };
