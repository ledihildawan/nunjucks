import { defaultTo, entries, join as joinRemeda, map, pipe, split } from 'remeda';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { normalize, safeString, safeHtml, preserveSafe, createStringFilter, createMacroFilter, isSafeString, isArray, requireArrayError } from '../factory/index.ts';
import type { SafeString } from '../factory/index.ts';

const capitalize = createStringFilter((s: string): string => {
  const returnValue = s.toLowerCase();
  return `${(returnValue[0] ?? '').toUpperCase()}${returnValue.slice(1)}`;
});

const fallback = createMacroFilter(['val', 'def', 'bool'], (value: unknown, def: unknown, bool?: boolean) => {
  if (bool) {
    return value || def;
  }
  if (value === null || value === undefined) {
    return def;
  }
  return value;
});

// biome-ignore lint/suspicious/noShadowRestrictedNames: `escape` is the public name of this Nunjucks filter; renaming it would break every template that uses it.
const escape = safeHtml;

const tojson = (value: unknown): SafeString => safeString(JSON.stringify(value));

const DEFAULT_INDENT_WIDTH = 4;

const indent = (str: unknown, width?: number, indentfirst?: boolean): string => {
  const normalizedString = normalize(str, '');
  if (normalizedString === '') { return ''; }
  const indentWidth = defaultTo(width, DEFAULT_INDENT_WIDTH);
  const indentSpaces = ' '.repeat(Math.round(indentWidth));
  const lines = normalizedString.split('\n');
  const res = lines.map((line: string, i: number) => {
    if (i === 0 && !indentfirst) {
      return line;
    }
    return `${indentSpaces}${line}`;
  }).join('\n');
  return preserveSafe(str, res);
};

const joinFilter = (values: unknown, del?: string, attr?: string): string => {
  if (!isArray(values)) { throw requireArrayError(values, ERROR_DEFINITIONS.JOIN_FILTER); }
  const delimiter = defaultTo(del, '');
  const items = attr ? values.map((v) => (v as Record<string, unknown>)[attr]) : values;
  return (items as unknown[]).join(delimiter);
};

const lower = createStringFilter((s: string): string => s.toLowerCase());

const replace = (str: unknown, old: unknown, newValue: string, maxCount?: number): string => {
  if (old instanceof RegExp) {
    const resolvedString = resolveString(str);
    return resolvedString === null ? String(str ?? '') : resolvedString.replace(old, newValue);
  }
  const max = maxCount ?? -1;
  const oldStr = resolveOldString(old);
  if (oldStr === null) { return str as string; }
  const s = resolveString(str);
  if (s === null) { return str as string; }
  if (oldStr === '') { return preserveSafe(str, newValue + pipe(s, split(''), joinRemeda(newValue)) + newValue); }
  const nextIndex = s.indexOf(oldStr);
  if (max === 0 || nextIndex === -1) { return s; }
  return preserveSafe(str, performReplace(s, { oldStr, newValue, max }));
};

const resolveOldString = (old: unknown): string | null => {
  if (typeof old === 'number') { return String(old); }
  if (typeof old === 'string') { return old; }
  return null;
};

const resolveString = (str: unknown): string | null => {
  if (typeof str === 'number') { return String(str); }
  if (typeof str === 'string' || isSafeString(str)) { return str as string; }
  return null;
};

const performReplace = (s: string, { oldStr, newValue, max }: { oldStr: string; newValue: string; max: number }): string => {
  if (oldStr === '') { return s; }
  const segments = s.split(oldStr);
  if (max === -1 || segments.length - 1 <= max) {
    return segments.join(newValue);
  }
  const head = segments.slice(0, max + 1).join(newValue);
  const tail = segments.slice(max + 1).join(oldStr);
  return head + oldStr + tail;
};

const title = createStringFilter((s: string): string => pipe(s, split(' '), map((word: string) => capitalize(word) as string), joinRemeda(' ')));

const trim = createStringFilter((s: string): string => s.trim());

const DEFAULT_TRUNCATE_LENGTH = 255;

const truncate = (input: unknown, length?: number, killwords?: boolean, end?: string): string => {
  const orig = input;
  const normalized = normalize(input, '');
  const initial = typeof normalized === 'string' ? normalized : String(normalized);
  const len = defaultTo(length, DEFAULT_TRUNCATE_LENGTH);
  if (initial.length <= len) { return initial; }
  const spaceIdx = initial.lastIndexOf(' ', len);
  const cutIdx = killwords ? len : spaceIdx === -1 ? len : spaceIdx;
  const result = initial.slice(0, cutIdx) + defaultTo(end, '...');
  return preserveSafe(orig, result);
};

const upper = createStringFilter((s: string): string => s.toUpperCase());

const urlencode = (queryParameters: unknown): string => {
  const enc = encodeURIComponent;
  if (typeof queryParameters === 'string') { return enc(queryParameters); }
  const keyvals = Array.isArray(queryParameters)
    ? (queryParameters as [string, unknown][])
    : entries(queryParameters as Record<string, unknown>);
  return pipe(keyvals, map(([k, v]) => `${enc(k)}=${enc(String(v))}`), joinRemeda('&'));
};

export { capitalize, fallback, escape, tojson, indent, joinFilter as join, lower, replace, title, trim, truncate, upper, urlencode };
