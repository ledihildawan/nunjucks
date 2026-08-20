import { escapeHtml } from '@nunjucks/lib';
import picocolors from 'picocolors';

const LEADING_WHITESPACE_RE = /^\s+/u;
const PLAIN_RUN_RE = /^[^<{}"'|\s]+/u;

/**
 * Escapes HTML first, then converts the supported inline markers — `` `code` `` and
 * `**bold**` — into styled `<code>`/`<strong>` elements.
 */
const renderInlineMarkdown = (text: string): string => {
  if (!text) {
    return '';
  }
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
    // WHY: kept in sync BY HAND with the statement-tag grammar in
    // parser/src/statement-parser/registry.ts — error-renderer cannot import it without
    // creating a package cycle (parser → error-formatter → error-renderer). The alternation
    // covers: registry tags + their end-tags and sub-clause keywords (case/default/when),
    // the lexer's raw aliases (raw/verbatim), and clause keywords (with/without/context/as).
    // When adding a new {% tag %} to the parser, add it here too or it will not highlight.
    re: /^(?:endverbatim|verbatim|endraw|raw|endfilter|filter|endcomponent|component|endrender|render|endslot|slot|endblock|block|endfor|for|endif|elif|else|if|endswitch|switch|case|default|exec|endscope|scope|endmatch|match|when|endcapture|capture|extends|include|import|from|with|without|context|as|not|and|or|in|is|true|false|none|null)(?![\w-])/u,
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

const matchHtmlRule = (
  rules: SyntaxRule[],
  rest: string,
  inTag: boolean
): HighlightChunk | null => {
  for (const rule of rules) {
    const matched = rest.match(rule.re)?.[0];
    if (matched) {
      const nextInTag = rule.toggle ? matched === '{{' || matched === '{%' : inTag;
      return { html: span(rule.type, matched), length: matched.length, inTag: nextInTag };
    }
  }
  return null;
};

const nextHtmlChunk = (rest: string, inTag: boolean): HighlightChunk => {
  const ws = rest.match(LEADING_WHITESPACE_RE)?.[0];
  if (ws) {
    return { html: ws, length: ws.length, inTag };
  }

  const applicableRules = SYNTAX_RULES.filter((r) => !r.tagOnly || inTag);
  const matched = matchHtmlRule(applicableRules, rest, inTag);
  if (matched) {
    return matched;
  }

  const plain = rest.match(PLAIN_RUN_RE)?.[0];
  if (plain) {
    return { html: escapeHtml(plain), length: plain.length, inTag };
  }

  return { html: escapeHtml(rest[0] ?? ''), length: 1, inTag };
};

/**
 * Highlights HTML with escaped `<span class="syntax-*">` markup. Tag-interior rules
 * (`keyword`, `variable`) apply only between `{{`/`{%` delimiters and their closers,
 * and the scan is iterative so multi-megabyte lines cannot overflow the stack.
 */
const highlightHtml = (code: string): string => {
  if (!code) {
    return '';
  }
  // WHY: iterative scan — per-chunk tail recursion overflowed the stack on multi-MB
  // single-line sources; loop exemption: recursion safety.
  let index = 0;
  let out = '';
  let inTag = false;
  while (index < code.length) {
    const chunk = nextHtmlChunk(code.slice(index), inTag);
    out += chunk.html;
    inTag = chunk.inTag;
    index += chunk.length;
  }
  return out;
};

const JS_RULES: SyntaxRule[] = [
  { type: 'comment', re: /^\/\/[^\n]*/u },
  { type: 'comment', re: /^\/\*[\s\S]*?\*\//u },
  { type: 'string', re: /^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*'|$'(?:[^'\\]|\\.)*')/u },
  { type: 'number', re: /^\d+(?:\.\d+)?/u },
  {
    type: 'keyword',
    re: /^(?:function|async|await|try|catch|finally|return|const|let|var|new|throw|typeof|void|delete|class|extends|super|import|export|default|yield|if|else|for|while|do|switch|case|break|continue|this|of|in|instanceof|type|enum|interface|namespace|module|declare|abstract|implements|public|private|protected|readonly|static|get|set|asserts|infer|keyof|never|unknown|any|debugger|with|as)(?![\w$])/u,
  },
  { type: 'variable', re: /^[a-zA-Z_$][\w$]*/u },
  {
    type: 'operator',
    re: /^(?:=>|==|!=|<=|>=|&&|\|\||<|>|\+|-|\*|\/|%|&|\||\^|!|=|\?|:|;|,|\.|\(|\)|\[|\]|\{|\}|\.\.\.)/u,
  },
];

const CSS_RULES: SyntaxRule[] = [
  { type: 'comment', re: /^\/\*[\s\S]*?\*\//u },
  { type: 'string', re: /^"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/u },
  { type: 'number', re: /^(?:\d+(?:\.\d+)?(?:px|em|rem|vh|vw|ch|ex|cm|mm|in|pt|pc|deg|rad|grad|turn|s|ms|%)?|\d+(?:\.\d+)?)/u },
  {
    type: 'keyword',
    re: /^(?:inherit|initial|unset|none|auto|normal|bold|italic|underline|overline|line-through|blink|hidden|scroll|auto|static|relative|absolute|fixed|sticky|block|inline|inline-block|flex|inline-flex|grid|inline-grid|table|inline-table|list-item|run-in|compact|contents|table-row|table-cell|table-row-group|table-header-group|table-footer-group|table-column|table-column-group|table-caption|separate|collapse|transparent|solid|double|groove|ridge|inset|outset|dotted|dashed|center|left|right|justify|both|freeze|print|page|always|avoid|avoid-page|avoid-column|avoid-page)(?![\w-])/u,
  },
  { type: 'variable', re: /^--[\w-]*/u },
  { type: 'attr', re: /^[\w-]+(?=\s*:)/u },
  { type: 'selector', re: /^[.#][\w-]+/u },
  { type: 'operator', re: /^[{}()[\]:;,>+~]/u },
];

const matchJsRule = (rules: SyntaxRule[], rest: string): HighlightChunk | null => {
  for (const rule of rules) {
    const matched = rest.match(rule.re)?.[0];
    if (matched) {
      return { html: span(rule.type, matched), length: matched.length, inTag: false };
    }
  }
  return null;
};

const nextJsChunk = (rest: string): HighlightChunk => {
  const ws = rest.match(LEADING_WHITESPACE_RE)?.[0];
  if (ws) {
    return { html: ws, length: ws.length, inTag: false };
  }

  const matched = matchJsRule(JS_RULES, rest);
  if (matched) {
    return matched;
  }

  return { html: escapeHtml(rest[0] ?? ''), length: 1, inTag: false };
};

const matchCssRule = (rules: SyntaxRule[], rest: string): HighlightChunk | null => {
  for (const rule of rules) {
    const matched = rest.match(rule.re)?.[0];
    if (matched) {
      return { html: span(rule.type, matched), length: matched.length, inTag: false };
    }
  }
  return null;
};

const nextCssChunk = (rest: string): HighlightChunk => {
  const ws = rest.match(LEADING_WHITESPACE_RE)?.[0];
  if (ws) {
    return { html: ws, length: ws.length, inTag: false };
  }

  const matched = matchCssRule(CSS_RULES, rest);
  if (matched) {
    return matched;
  }

  return { html: escapeHtml(rest[0] ?? ''), length: 1, inTag: false };
};

/**
 * Highlights JavaScript with the same escaped-span scheme as `highlightHtml` (minus the
 * tag-interior toggle), via an iterative scan for recursion safety.
 */
const highlightJs = (code: string): string => {
  if (!code) {
    return '';
  }
  // WHY: iterative scan — same recursion-safety rationale as highlightHtml.
  let index = 0;
  let out = '';
  while (index < code.length) {
    const chunk = nextJsChunk(code.slice(index));
    out += chunk.html;
    index += chunk.length;
  }
  return out;
};

/**
 * Highlights CSS with the same escaped-span scheme as `highlightJs`.
 */
const highlightCss = (code: string): string => {
  if (!code) {
    return '';
  }
  let index = 0;
  let out = '';
  while (index < code.length) {
    const chunk = nextCssChunk(code.slice(index));
    out += chunk.html;
    index += chunk.length;
  }
  return out;
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
  selector: (text) => picocolors.red(text),
};

const colorize = (type: string, text: string): string =>
  (ANSI_COLOR_MAP[type] ?? ((t: string) => t))(text);

interface AnsiChunk {
  text: string;
  length: number;
  inTag: boolean;
}

const matchAnsiRule = (
  rules: readonly SyntaxRule[],
  rest: string,
  inTag: boolean
): AnsiChunk | null => {
  for (const rule of rules) {
    const matched = rest.match(rule.re)?.[0];
    if (matched) {
      const nextInTag = rule.toggle ? matched === '{{' || matched === '{%' : inTag;
      return { text: colorize(rule.type, matched), length: matched.length, inTag: nextInTag };
    }
  }
  return null;
};

const nextAnsiChunk = (rest: string, inTag: boolean): AnsiChunk => {
  const ws = rest.match(LEADING_WHITESPACE_RE)?.[0];
  if (ws) {
    return { text: ws, length: ws.length, inTag };
  }

  const applicableRules = SYNTAX_RULES.filter((r) => !r.tagOnly || inTag);
  const matched = matchAnsiRule(applicableRules, rest, inTag);
  if (matched) {
    return matched;
  }

  const plain = rest.match(PLAIN_RUN_RE)?.[0];
  if (plain) {
    return { text: plain, length: plain.length, inTag };
  }

  return { text: rest[0] ?? '', length: 1, inTag };
};

/**
 * Highlights template syntax directly to ANSI colors using the same tokenizer as the
 * HTML path, so terminal and browser output stay visually consistent; unknown token
 * types pass through uncolored.
 */
const highlightAnsi = (code: string): string => {
  if (!code) {
    return '';
  }
  // WHY: iterative scan — same recursion-safety rationale as highlightHtml.
  let index = 0;
  let out = '';
  let inTag = false;
  while (index < code.length) {
    const chunk = nextAnsiChunk(code.slice(index), inTag);
    out += chunk.text;
    inTag = chunk.inTag;
    index += chunk.length;
  }
  return out;
};

export { escapeAttribute, escapeHtml } from '@nunjucks/lib';
export { highlightAnsi, highlightCss, highlightHtml, highlightJs, renderInlineMarkdown };
