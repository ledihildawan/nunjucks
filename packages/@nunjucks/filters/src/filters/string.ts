// biome-ignore lint/style/noExcessiveLinesPerFile: the string module is one cohesive upstream-parity group sharing createStringFilter/normalize/preserveSafe conventions; splitting it would scatter the SafeString threading every filter here repeats
import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import {
  err,
  escapeAttribute,
  escapeHtml,
  getAttrGetter,
  markSafe,
  ok,
  type Result,
} from '@nunjucks/lib';
import { defaultTo, join as joinRemeda, map, pipe, split } from 'remeda';
import type { SafeString } from '../factory/index.ts';
import {
  createFilter,
  createFilterError,
  createMacroFilter,
  createStringFilter,
  isArray,
  isSafeString,
  normalize,
  preserveSafe,
  requireArrayError,
  safeHtml,
  safeString,
  validateItemsHaveAttr,
} from '../factory/index.ts';

const capitalizeString = (s: string): string => {
  const lowercased = s.toLowerCase();
  return `${(lowercased[0] ?? '').toUpperCase()}${lowercased.slice(1)}`;
};

/** Capitalizes the first letter and lowercases the rest of the string form. */
const capitalize = createStringFilter(capitalizeString);

// WHY: `bool` is `unknown`, not boolean — the macro-filter wrapper invokes implementations
// with unknown args; the parameter is only truthiness-checked.
// WHY: upstream `default` substitutes for undefined ONLY — `null` is an explicit value and
// passes through (the old nullish substitution silently flipped ported templates that rely
// on null rendering as ''); `bool` keeps upstream's falsy (`||`) mode.
const fallbackImpl = (
  value: unknown,
  def: unknown,
  bool?: unknown
): Result<unknown, TemplateError> => {
  if (bool) {
    return ok(value || def);
  }
  return ok(value === undefined ? def : value);
};

/** Substitutes `def` when the value is undefined — or falsy when `bool` is set. */
const fallback = createMacroFilter(['val', 'def', 'bool'], fallbackImpl);

/**
 * HTML-escapes the string form of the input and returns a `SafeString`, so
 * the escaped markup is never double-escaped downstream.
 */
// biome-ignore lint/suspicious/noShadowRestrictedNames: `escape` is the public name of this Nunjucks filter; renaming it would break every template that uses it.
const escape = (str: unknown): Result<SafeString, TemplateError> => ok(safeHtml(str));

// WHY: JSON.stringify leaves <, >, & unescaped; since tojson yields a SafeString that bypasses
// autoescape (and the script-context JSON guard), a literal "</script>" inside a value would
// break out of script/HTML contexts. \u003c-style escapes keep the output valid, round-trippable JSON.
const escapeJsonForMarkup = (serialized: string): string =>
  serialized.replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');

const serializeJsonValue = (value: unknown): string => JSON.stringify(value) ?? 'undefined';

/**
 * Serializes any value to JSON, `\u003c`-escaping `<`, `>`, `&` so the
 * `SafeString` output stays inert inside script and HTML contexts.
 */
const tojson = (value: unknown): Result<SafeString, TemplateError> =>
  ok(pipe(value, serializeJsonValue, escapeJsonForMarkup, safeString));

const DEFAULT_INDENT_WIDTH = 4;

interface IndentOptions {
  str: unknown;
  width?: number;
  indentfirst?: boolean;
}

const indentImpl = ({
  str,
  width,
  indentfirst,
}: IndentOptions): Result<string | SafeString, TemplateError> => {
  const normalizedString = normalize(str, '');
  if (normalizedString === '') {
    return ok('');
  }
  const indentWidth = defaultTo(width, DEFAULT_INDENT_WIDTH);
  const indentSpaces = ' '.repeat(Math.round(indentWidth));
  const lines = normalizedString.split('\n');
  const indented = lines
    .map((line: string, i: number) => {
      if (i === 0 && !indentfirst) {
        return line;
      }
      return `${indentSpaces}${line}`;
    })
    .join('\n');
  return ok(preserveSafe(str, indented));
};

/** Indents every line but the first by `width` (default 4) spaces. */
const indent = createFilter(['str', 'width', 'indentfirst'], indentImpl);

// WHY: createFilter-wrapped so BOTH forms bind — positional `join('-')` and kwargs
// `join(delim='-')`. A bare positional function would receive the compiler's keywords
// envelope as the delimiter and render "[object Object]" separators.
interface JoinFilterOptions {
  values: unknown;
  delim?: string;
  attr?: string;
}

const joinImpl = ({ values, delim, attr }: JoinFilterOptions): Result<string, TemplateError> => {
  if (!isArray(values)) {
    return err(requireArrayError(values, ERROR_DEFINITIONS.JOIN_FILTER));
  }
  const resolvedDelimiter = defaultTo(delim, '');
  if (!attr) {
    return ok(values.join(resolvedDelimiter));
  }
  const validatedResult = validateItemsHaveAttr({
    items: values,
    attr,
    errorDef: ERROR_DEFINITIONS.JOIN_FILTER,
  });
  if (!validatedResult.ok) {
    return err(validatedResult.error);
  }
  // WHY: attr may be a dotted path ('user.name'); getAttrGetter resolves it with the
  // same own-property walk the validation above performed.
  const getAttr = getAttrGetter(attr);
  return ok(validatedResult.value.map((item) => getAttr(item)).join(resolvedDelimiter));
};

/** Joins array items — or their `attr` values — with `delim` (default empty). */
const join = createFilter(['values', 'delim', 'attr'], joinImpl);

/** Lowercases the string form of the input value. */
const lower = createStringFilter((s: string): string => s.toLowerCase());

const resolveOldString = (old: unknown): string | null => {
  if (typeof old === 'number') {
    return String(old);
  }
  if (typeof old === 'string') {
    return old;
  }
  return null;
};

const resolveString = (str: unknown): string | null => {
  if (typeof str === 'number') {
    return String(str);
  }
  if (typeof str === 'string' || isSafeString(str)) {
    return str as string;
  }
  return null;
};

const performReplace = (
  text: string,
  { oldStr, replacement, max }: { oldStr: string; replacement: string; max: number }
): string => {
  if (oldStr === '') {
    return text;
  }
  const segments = text.split(oldStr);
  if (max === -1 || segments.length - 1 <= max) {
    return segments.join(replacement);
  }
  const head = segments.slice(0, max + 1).join(replacement);
  const tail = segments.slice(max + 1).join(oldStr);
  return head + oldStr + tail;
};

// WHY: returns `unknown` — when the needle or input cannot be resolved to a string, the
// filter passes the input through untouched (nunjucks parity, pinned by tests); pretending
// the result is always a string would be an unsound cast.
const applyReplace = ({ str, old: oldValue, newValue, maxCount }: ReplaceOptions): unknown => {
  // WHY: an omitted/invalid replacement defaults to deletion (''). It used to reach
  // Array.join as undefined — coercing the separator to ',' — so `replace("-")` turned
  // "a-b-c" into "a,b,c": silent data corruption (RegExp branch inserted the literal
  // string "undefined" instead).
  const replacement = typeof newValue === 'string' ? newValue : '';
  if (oldValue instanceof RegExp) {
    const resolvedString = resolveString(str);
    return resolvedString === null
      ? String(str ?? '')
      : resolvedString.replace(oldValue, replacement);
  }
  const max = maxCount ?? -1;
  const oldStr = resolveOldString(oldValue);
  if (oldStr === null) {
    return str;
  }
  const resolvedInput = resolveString(str);
  if (resolvedInput === null) {
    return str;
  }
  if (oldStr === '') {
    return preserveSafe(
      str,
      replacement + pipe(resolvedInput, split(''), joinRemeda(replacement)) + replacement
    );
  }
  const nextIndex = resolvedInput.indexOf(oldStr);
  if (max === 0 || nextIndex === -1) {
    return resolvedInput;
  }
  return preserveSafe(str, performReplace(resolvedInput, { oldStr, replacement, max }));
};

interface ReplaceOptions {
  str: unknown;
  old: unknown;
  newValue?: string;
  maxCount?: number;
}

const replaceImpl = (replaceOptions: ReplaceOptions): Result<unknown, TemplateError> =>
  ok(applyReplace(replaceOptions));

/**
 * Replaces `old` with `newValue` up to `maxCount` times (default all),
 * accepting plain strings, numbers, or a `RegExp`; unresolvable needles or
 * inputs pass the input through untouched.
 */
const replace = createFilter(['str', 'old', 'newValue', 'maxCount'], replaceImpl);

/** Title-cases the string form by capitalizing each space-separated word. */
const title = createStringFilter((s: string): string =>
  pipe(s, split(' '), map(capitalizeString), joinRemeda(' '))
);

/** Trims leading and trailing whitespace from the string form of the input. */
const trim = createStringFilter((s: string): string => s.trim());

interface TruncateOptions {
  input: unknown;
  length?: number;
  killwords?: boolean;
  end?: string;
}

const DEFAULT_TRUNCATE_LENGTH = 255;

const truncateImpl = ({
  input,
  length,
  killwords,
  end,
}: TruncateOptions): Result<string | SafeString, TemplateError> => {
  const originalInput = input;
  const normalized = normalize(input, '');
  const initial = typeof normalized === 'string' ? normalized : String(normalized);
  const len = defaultTo(length, DEFAULT_TRUNCATE_LENGTH);
  if (initial.length <= len) {
    return ok(initial);
  }
  const spaceIdx = initial.lastIndexOf(' ', len);
  const cutIdx = killwords ? len : spaceIdx === -1 ? len : spaceIdx;
  const result = initial.slice(0, cutIdx) + defaultTo(end, '...');
  return ok(preserveSafe(originalInput, result));
};

/**
 * Truncates to `length` (default 255) at a word boundary and appends `end`
 * (default `...`); `killwords` cuts mid-word instead.
 */
const truncate = createFilter(['input', 'length', 'killwords', 'end'], truncateImpl);

/** Uppercases the string form of the input value. */
const upper = createStringFilter((s: string): string => s.toUpperCase());

interface CenterOptions {
  str: unknown;
  width?: number;
}

const DEFAULT_CENTER_WIDTH = 80;

const centerImpl = ({ str, width }: CenterOptions): Result<string | SafeString, TemplateError> => {
  const text = normalize(str, '');
  const targetWidth = defaultTo(width, DEFAULT_CENTER_WIDTH);
  if (text.length >= targetWidth) {
    return ok(preserveSafe(str, text));
  }
  const spaces = targetWidth - text.length;
  // WHY: exact floor/remainder split — upstream's loop-based repeat yields
  // width-1 output for odd padding; keeping pre + text + post === width is
  // the invariant the filter's name promises.
  const pre = Math.floor(spaces / 2);
  const post = spaces - pre;
  return ok(preserveSafe(str, `${' '.repeat(pre)}${text}${' '.repeat(post)}`));
};

/** Centers the string form in a field of `width` (default 80) spaces. */
const center = createFilter(['str', 'width'], centerImpl);

/**
 * Marks the string form of the input safe so autoescape passes it through
 * verbatim; `SafeString` inputs pass through unchanged.
 */
const safe = (str: unknown): Result<SafeString, TemplateError> => ok(safeString(str));

/**
 * HTML-escapes even `SafeString` inputs — unlike `escape`, no safeness
 * passthrough — returning a fresh safe-wrapped escape of the raw text.
 */
const forceescape = (str: unknown): Result<SafeString, TemplateError> => {
  const text = str === null || str === undefined ? '' : String(str);
  return ok(markSafe(escapeHtml(text)));
};

// WHY: safeness-preserving (upstream copySafeness), NOT unconditionally markSafe —
// plain-text input stays autoescaped so hostile markup cannot ride nl2br into raw
// output; the documented idiom is `text |> escape |> nl2br`, where the escaped
// SafeString keeps the inserted <br /> verbatim.
const nl2br = (str: unknown): Result<string | SafeString, TemplateError> => {
  if (str === null || str === undefined) {
    return ok('');
  }
  return ok(preserveSafe(str, String(str).replaceAll(/\r\n|\n/g, '<br />\n')));
};

/** Converts a value to its string form, preserving any SafeString marking. */
const string = (obj: unknown): Result<string | SafeString, TemplateError> => {
  // WHY: String(Symbol) throws a raw TypeError — surface it as a catalogued
  // filter error like every other contract breach instead.
  if (typeof obj === 'symbol') {
    return err(
      createFilterError({
        errorDef: undefined,
        params: { type: 'symbol' },
        subject: 'symbol',
        fallbackMessage: 'string: symbol values cannot be converted to a string',
      })
    );
  }
  return ok(preserveSafe(obj, normalize(obj, '')));
};

const STRIP_TAGS_RE = /<\/?([a-z][a-z0-9]*)\b[^>]*>|<!--[\s\S]*?-->/gi;

interface StriptagsOptions {
  input: unknown;
  preserveLinebreaks?: boolean | string;
}

const isTruthyKwarg = (value: boolean | string | undefined): boolean =>
  value === true || value === 'true';

const striptagsImpl = ({
  input,
  preserveLinebreaks,
}: StriptagsOptions): Result<string | SafeString, TemplateError> => {
  // WHY: regex approximation (upstream's exact approach) — stripping tags
  // without a DOM parser misses malformed/nested edge cases; pairing with
  // `escape` (or the opt-in sanitize filter) is the safe pattern.
  const trimmed = normalize(input, '').replace(STRIP_TAGS_RE, '').trim();
  const result = isTruthyKwarg(preserveLinebreaks)
    ? trimmed
        .replace(/^ +| +$/gm, '')
        .replace(/ +/g, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
    : trimmed.replace(/\s+/gi, ' ');
  return ok(preserveSafe(input, result));
};

/** Strips HTML tags (regex-based) and collapses whitespace; optionally keeps linebreaks. */
const striptags = createFilter(['input', 'preserveLinebreaks'], striptagsImpl);

const PUNC_RE = /^(?:\(|<|&lt;)?(.*?)(?:\.|,|\)|\n|&gt;)?$/;
const EMAIL_RE = /^[\w.!#$%&'*+\-/=?^`{|}~]+@[a-z\d-]+(\.[a-z\d-]+)+$/i;
const HTTP_HTTPS_RE = /^https?:\/\/.*$/;
const WWW_RE = /^www\./;
const TLD_RE = /\.(?:org|net|com)(?::|\/|$)/;

interface UrlizeOptions {
  str: unknown;
  length?: number;
  nofollow?: boolean;
}

const urlizeImpl = ({
  str,
  length,
  nofollow,
}: UrlizeOptions): Result<SafeString, TemplateError> => {
  // WHY: NaN/missing length means "no truncation" (upstream isNaN check) —
  // Infinity slices cleanly in String.prototype.slice.
  const maxLength =
    typeof length === 'number' && !Number.isNaN(length) ? length : Number.POSITIVE_INFINITY;
  const noFollowAttr = nofollow === true ? ' rel="nofollow"' : '';
  const words = normalize(str, '')
    .split(/(\s+)/)
    .filter((word) => word.length > 0)
    .map((word) => {
      // WHY: puncRe peels surrounding punctuation/angle brackets off the word so
      // "see (example.com)" links example.com while the parens stay plain text.
      const possibleUrl = word.match(PUNC_RE)?.[1] ?? word;
      const shortUrl = possibleUrl.slice(0, maxLength);
      // WHY: the anchor is markup of the filter's own construction — the href is
      // attribute-encoded (escapeAttribute, the quoted-attribute entity set) and the
      // display text HTML-escaped, so input like `http://x" onmouseover="alert(1)`
      // cannot terminate the href attribute or inject markup through the anchor body.
      if (HTTP_HTTPS_RE.test(possibleUrl)) {
        return `<a href="${escapeAttribute(possibleUrl)}"${noFollowAttr}>${escapeHtml(shortUrl)}</a>`;
      }
      if (WWW_RE.test(possibleUrl)) {
        return `<a href="http://${escapeAttribute(possibleUrl)}"${noFollowAttr}>${escapeHtml(shortUrl)}</a>`;
      }
      if (EMAIL_RE.test(possibleUrl)) {
        return `<a href="mailto:${escapeAttribute(possibleUrl)}">${escapeHtml(possibleUrl)}</a>`;
      }
      if (TLD_RE.test(possibleUrl)) {
        return `<a href="http://${escapeAttribute(possibleUrl)}"${noFollowAttr}>${escapeHtml(shortUrl)}</a>`;
      }
      // WHY: non-URL words are pre-escaped here because the joined output is marked
      // safe below — otherwise hostile markup riding a plain word would bypass
      // autoescape verbatim once the whole string is elevated to SafeString.
      return escapeHtml(word);
    });
  // WHY: marked safe unconditionally (upstream templates must pipe `| urlize | safe`
  // themselves; this port makes safe markup the default) — sound ONLY because every
  // non-anchor segment above is already escaped, so the anchor survives autoescape
  // instead of being entity-destroyed as it was when a plain string was returned.
  return ok(markSafe(words.join('')));
};

/**
 * Converts bare URLs, `www.` hosts, and emails in the text into anchor tags —
 * attribute-encoding the href and HTML-escaping the display text — and returns
 * a `SafeString` so autoescape renders working anchors; display text truncates
 * beyond `length`; `nofollow=true` adds `rel="nofollow"`.
 */
const urlize = createFilter(['str', 'length', 'nofollow'], urlizeImpl);

/**
 * Counts whitespace-delimited words; a nullish/empty input is 0 rather than
 * upstream's null (strict-Result filters never leak nullish into `number`).
 */
const wordcount = (str: unknown): Result<number, TemplateError> =>
  ok(normalize(str, '').match(/\w+/g)?.length ?? 0);

export {
  capitalize,
  center,
  escape,
  fallback,
  forceescape,
  indent,
  join,
  lower,
  nl2br,
  replace,
  safe,
  string,
  striptags,
  title,
  tojson,
  trim,
  truncate,
  upper,
  urlize,
  wordcount,
};
