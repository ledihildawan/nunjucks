import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import { err, ok, type Result } from '@nunjucks/lib';
import { defaultTo, entries, join as joinRemeda, map, pipe, split } from 'remeda';
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
} from '../factory/index.ts';

const capitalizeString = (s: string): string => {
  const lowercased = s.toLowerCase();
  return `${(lowercased[0] ?? '').toUpperCase()}${lowercased.slice(1)}`;
};

const capitalize = createStringFilter(capitalizeString);

const fallbackImpl = (
  value: unknown,
  def: unknown,
  bool?: boolean
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

const tojson = (value: unknown): Result<SafeString, TemplateError> =>
  ok(safeString(escapeJsonForMarkup(JSON.stringify(value) ?? 'undefined')));

const DEFAULT_INDENT_WIDTH = 4;

interface IndentOptions {
  str: unknown;
  width?: number;
  indentfirst?: boolean;
}

const indentImpl = ({ str, width, indentfirst }: IndentOptions): Result<string, TemplateError> => {
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

const joinFilter = (
  values: unknown,
  delimiter?: string,
  attr?: string
): Result<string, TemplateError> => {
  if (!isArray(values)) {
    return err(requireArrayError(values, ERROR_DEFINITIONS.JOIN_FILTER));
  }
  const resolvedDelimiter = defaultTo(delimiter, '');
  const items = attr ? values.map((v) => (v as Record<string, unknown>)[attr]) : values;
  return ok((items as unknown[]).join(resolvedDelimiter));
};

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
  s: string,
  { oldStr, newValue, max }: { oldStr: string; newValue: string; max: number }
): string => {
  if (oldStr === '') {
    return s;
  }
  const segments = s.split(oldStr);
  if (max === -1 || segments.length - 1 <= max) {
    return segments.join(newValue);
  }
  const head = segments.slice(0, max + 1).join(newValue);
  const tail = segments.slice(max + 1).join(oldStr);
  return head + oldStr + tail;
};

const applyReplace = (str: unknown, old: unknown, newValue: string, maxCount?: number): string => {
  if (old instanceof RegExp) {
    const resolvedString = resolveString(str);
    return resolvedString === null ? String(str ?? '') : resolvedString.replace(old, newValue);
  }
  const max = maxCount ?? -1;
  const oldStr = resolveOldString(old);
  if (oldStr === null) {
    return str as string;
  }
  const resolvedInput = resolveString(str);
  if (resolvedInput === null) {
    return str as string;
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

const replaceImpl = ({
  str,
  old,
  newValue,
  maxCount,
}: ReplaceOptions): Result<string, TemplateError> => ok(applyReplace(str, old, newValue, maxCount));

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
}: TruncateOptions): Result<string, TemplateError> => {
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

const urlencode = (queryParameters: unknown): Result<string, TemplateError> => {
  const enc = encodeURIComponent;
  if (typeof queryParameters === 'string') {
    return ok(enc(queryParameters));
  }
  const keyvals = Array.isArray(queryParameters)
    ? (queryParameters as [string, unknown][])
    : entries(queryParameters as Record<string, unknown>);
  return ok(
    pipe(
      keyvals,
      map(([key, val]) => `${enc(key)}=${enc(String(val))}`),
      joinRemeda('&')
    )
  );
};

export {
  capitalize,
  escape,
  fallback,
  indent,
  joinFilter as join,
  lower,
  replace,
  title,
  tojson,
  trim,
  truncate,
  upper,
  urlencode,
};
