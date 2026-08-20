import { escapeHtml } from '@nunjucks/lib';
import picocolors from 'picocolors';
import { CSS_RULES, JS_RULES, SYNTAX_RULES, type SyntaxRule } from './syntax-rules.ts';

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
