import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import { err, getAttrGetter, ok, type Result } from '@nunjucks/lib';
import { defaultTo, join as joinRemeda, map, pipe, split } from 'remeda';
import type { SafeString } from '../factory/index.ts';
import {
  createFilter,
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
const fallbackImpl = (
  value: unknown,
  def: unknown,
  bool?: unknown
): Result<unknown, TemplateError> => {
  if (bool) {
    return ok(value || def);
  }
  if (value === null || value === undefined) {
    return ok(def);
  }
  return ok(value);
};

/** Substitutes `def` when the value is nullish — or falsy when `bool` is set. */
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

export {
  capitalize,
  escape,
  fallback,
  indent,
  join,
  lower,
  replace,
  title,
  tojson,
  trim,
  truncate,
  upper,
};
