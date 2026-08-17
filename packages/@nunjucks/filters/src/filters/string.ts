import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import { err, ok, type Result } from '@nunjucks/lib';
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

const fallback = createMacroFilter(['val', 'def', 'bool'], fallbackImpl);

// biome-ignore lint/suspicious/noShadowRestrictedNames: `escape` is the public name of this Nunjucks filter; renaming it would break every template that uses it.
const escape = (str: unknown): Result<SafeString, TemplateError> => ok(safeHtml(str));

// WHY: JSON.stringify leaves <, >, & unescaped; since tojson yields a SafeString that bypasses
// autoescape (and the script-context JSON guard), a literal "</script>" inside a value would
// break out of script/HTML contexts. \u003c-style escapes keep the output valid, round-trippable JSON.
const escapeJsonForMarkup = (serialized: string): string =>
  serialized
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');

const serializeJsonValue = (value: unknown): string => JSON.stringify(value) ?? 'undefined';

const tojson = (value: unknown): Result<SafeString, TemplateError> =>
  ok(
    pipe(
      value,
      serializeJsonValue,
      escapeJsonForMarkup,
      safeString
    )
  );

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
  return ok(validatedResult.value.map((item) => item[attr]).join(resolvedDelimiter));
};

const join = createFilter(['values', 'delim', 'attr'], joinImpl);

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
  { oldStr, newValue, max }: { oldStr: string; newValue: string; max: number }
): string => {
  if (oldStr === '') {
    return text;
  }
  const segments = text.split(oldStr);
  if (max === -1 || segments.length - 1 <= max) {
    return segments.join(newValue);
  }
  const head = segments.slice(0, max + 1).join(newValue);
  const tail = segments.slice(max + 1).join(oldStr);
  return head + oldStr + tail;
};

// WHY: returns `unknown` — when the needle or input cannot be resolved to a string, the
// filter passes the input through untouched (nunjucks parity, pinned by tests); pretending
// the result is always a string would be an unsound cast.
const applyReplace = ({
  str,
  old: oldValue,
  newValue,
  maxCount,
}: ReplaceOptions): unknown => {
  if (oldValue instanceof RegExp) {
    const resolvedString = resolveString(str);
    return resolvedString === null ? String(str ?? '') : resolvedString.replace(oldValue, newValue);
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
      newValue + pipe(resolvedInput, split(''), joinRemeda(newValue)) + newValue
    );
  }
  const nextIndex = resolvedInput.indexOf(oldStr);
  if (max === 0 || nextIndex === -1) {
    return resolvedInput;
  }
  return preserveSafe(str, performReplace(resolvedInput, { oldStr, newValue, max }));
};

interface ReplaceOptions {
  str: unknown;
  old: unknown;
  newValue: string;
  maxCount?: number;
}

const replaceImpl = (replaceOptions: ReplaceOptions): Result<unknown, TemplateError> =>
  ok(applyReplace(replaceOptions));

const replace = createFilter(['str', 'old', 'newValue', 'maxCount'], replaceImpl);

const title = createStringFilter((s: string): string =>
  pipe(
    s,
    split(' '),
    map(capitalizeString),
    joinRemeda(' ')
  )
);

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

const truncate = createFilter(['input', 'length', 'killwords', 'end'], truncateImpl);

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
