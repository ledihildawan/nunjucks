import { escapeHtml } from '@nunjucks/lib';
import picocolors from 'picocolors';
import { CSS_RULES, JS_RULES, SYNTAX_RULES, type SyntaxRule } from './syntax-rules.ts';

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

// WHY: sticky variants of the ^-anchored rule tables — scanning in place via
// `lastIndex` avoids the per-chunk `code.slice(index)` tail copies that made
// multi-megabyte lines O(n²) in substrings, defeating the iterative loop's own
// recursion-safety rationale. Sticky also pins the match to the scan position,
// where a sliced unanchored `.match()` would have matched anywhere in the tail.
interface StickyRule {
  type: string;
  re: RegExp;
  tagOnly?: boolean;
  toggle?: boolean;
}

const toStickyRule = (rule: SyntaxRule): StickyRule => ({
  type: rule.type,
  tagOnly: rule.tagOnly,
  toggle: rule.toggle,
  re: new RegExp(rule.re.source.replace(/^\^/u, ''), `${rule.re.flags}y`),
});

const LEADING_WHITESPACE_RE = /\s+/uy;
const PLAIN_RUN_RE = /[^<{}"'|\s]+/uy;

const matchSticky = (re: RegExp, code: string, index: number): string | null => {
  re.lastIndex = index;
  return re.exec(code)?.[0] ?? null;
};

interface Chunk {
  output: string;
  length: number;
  inTag: boolean;
}

/** Per-language scan behavior: rule table plus how rule-matched and plain text render. */
interface ScannerMode {
  rules: readonly StickyRule[];
  wrap: (type: string, text: string) => string;
  plain: (text: string) => string;
  plainRuns: boolean;
}

const matchRule = (
  rules: readonly StickyRule[],
  code: string,
  index: number,
  inTag: boolean,
  wrap: ScannerMode['wrap']
): Chunk | null => {
  for (const rule of rules) {
    // WHY: inline tagOnly skip — filtering the rule list per chunk allocated a
    // fresh array for every character of scanned input.
    if (rule.tagOnly && !inTag) {
      continue;
    }
    const matched = matchSticky(rule.re, code, index);
    if (matched !== null) {
      const nextInTag = rule.toggle ? matched === '{{' || matched === '{%' : inTag;
      return { output: wrap(rule.type, matched), length: matched.length, inTag: nextInTag };
    }
  }
  return null;
};

const nextChunk = (code: string, index: number, inTag: boolean, mode: ScannerMode): Chunk => {
  const whitespace = matchSticky(LEADING_WHITESPACE_RE, code, index);
  if (whitespace !== null) {
    return { output: whitespace, length: whitespace.length, inTag };
  }

  const matched = matchRule(mode.rules, code, index, inTag, mode.wrap);
  if (matched) {
    return matched;
  }

  if (mode.plainRuns) {
    const plain = matchSticky(PLAIN_RUN_RE, code, index);
    if (plain !== null) {
      return { output: mode.plain(plain), length: plain.length, inTag };
    }
  }

  return { output: mode.plain(code[index] ?? ''), length: 1, inTag };
};

/**
 * Iterative scanner shared by every highlighter — whitespace run, first matching
 * rule, optional plain run, single-character fallback.
 */
const scan = (code: string, mode: ScannerMode): string => {
  if (!code) {
    return '';
  }
  // WHY: iterative scan — per-chunk tail recursion overflowed the stack on multi-MB
  // single-line sources; loop exemption: recursion safety.
  let index = 0;
  let out = '';
  let inTag = false;
  while (index < code.length) {
    const chunk = nextChunk(code, index, inTag, mode);
    out += chunk.output;
    inTag = chunk.inTag;
    index += chunk.length;
  }
  return out;
};

const HTML_MODE: ScannerMode = {
  rules: SYNTAX_RULES.map(toStickyRule),
  wrap: span,
  plain: escapeHtml,
  plainRuns: true,
};

const JS_MODE: ScannerMode = {
  rules: JS_RULES.map(toStickyRule),
  wrap: span,
  plain: escapeHtml,
  plainRuns: false,
};

const CSS_MODE: ScannerMode = {
  rules: CSS_RULES.map(toStickyRule),
  wrap: span,
  plain: escapeHtml,
  plainRuns: false,
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

const ANSI_MODE: ScannerMode = {
  rules: SYNTAX_RULES.map(toStickyRule),
  wrap: colorize,
  plain: (text) => text,
  plainRuns: true,
};

/**
 * Highlights HTML with escaped `<span class="syntax-*">` markup. Tag-interior rules
 * (`keyword`, `variable`) apply only between `{{`/`{%` delimiters and their closers,
 * and the scan is iterative so multi-megabyte lines cannot overflow the stack.
 */
const highlightHtml = (code: string): string => scan(code, HTML_MODE);

/** Highlights JavaScript with the same escaped-span scheme, minus the tag toggle. */
const highlightJs = (code: string): string => scan(code, JS_MODE);

/** Highlights CSS with the same escaped-span scheme as `highlightJs`. */
const highlightCss = (code: string): string => scan(code, CSS_MODE);

/**
 * Highlights template syntax directly to ANSI colors using the same tokenizer as the
 * HTML path, so terminal and browser output stay visually consistent; unknown token
 * types pass through uncolored.
 */
const highlightAnsi = (code: string): string => scan(code, ANSI_MODE);

export { escapeAttribute, escapeHtml } from '@nunjucks/lib';
export { highlightAnsi, highlightCss, highlightHtml, highlightJs, renderInlineMarkdown };
