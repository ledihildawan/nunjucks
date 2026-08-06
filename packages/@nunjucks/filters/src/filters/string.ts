import { defaultTo, entries, join as joinRemeda, map, pipe, split } from 'remeda';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { normalize, safeString, safeHtml, preserveSafe, createStringFilter, createMacroFilter, isSafeString, isArray, requireArrayError } from '../factory/index.ts';
import type { SafeString } from '../factory/index.ts';

const capitalize = createStringFilter((s: string): string => {
  const ret = s.toLowerCase();
  return `${ret.charAt(0).toUpperCase()}${ret.slice(1)}`;
});

const fallback = createMacroFilter(['val', 'def', 'bool'], (val: unknown, def: unknown, bool?: boolean) => {
  if (bool) {
    return val || def;
  }
  if (val === null || val === undefined) {
    return def;
  }
  return val;
});

// biome-ignore lint/suspicious/noShadowRestrictedNames: `escape` is the public name of this Nunjucks filter; renaming it would break every template that uses it.
const escape = safeHtml;

const tojson = (value: unknown): SafeString => safeString(JSON.stringify(value));

/** Jinja2's `indent` filter defaults to four spaces. */
const DEFAULT_INDENT_WIDTH = 4;

const indent = (str: unknown, width?: number, indentfirst?: boolean): string => {
  const s = normalize(str, '');
  if (s === '') { return ''; }
  const w = defaultTo(width, DEFAULT_INDENT_WIDTH);
  const sp = ' '.repeat(Math.round(w));
  const lines = s.split('\n');
  const res = lines.map((l: string, i: number) => {
    if (i === 0 && !indentfirst) {
      return l;
    }
    return `${sp}${l}`;
  }).join('\n');
  return preserveSafe(str, res);
};

const joinFilter = (arr: unknown, del?: string, attr?: string): string => {
  if (!isArray(arr)) { throw requireArrayError(arr, ERROR_DEFINITIONS.JOIN_FILTER); }
  const d = defaultTo(del, '');
  const values = attr ? arr.map((v) => (v as Record<string, unknown>)[attr]) : arr;
  return (values as unknown[]).join(d);
};

const lower = createStringFilter((s: string): string => s.toLowerCase());

const replace = (str: unknown, old: unknown, new_: string, maxCount?: number): string => {
  const originalStr = str;
  if (old instanceof RegExp) { return (str as string).replace(old, new_); }
  const max = maxCount ?? -1;
  const oldStr = resolveOldString(old);
  if (oldStr === null) { return str as string; }
  const s = resolveString(str);
  if (s === null) { return str as string; }
  if (oldStr === '') { return preserveSafe(originalStr, new_ + pipe(s, split(''), joinRemeda(new_)) + new_); }
  const nextIndex = s.indexOf(oldStr);
  if (max === 0 || nextIndex === -1) { return s; }
  return preserveSafe(originalStr, performReplace(s, oldStr, new_, max));
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

const performReplace = (s: string, oldStr: string, new_: string, max: number): string => {
  if (oldStr === '') { return s; }
  const segments = s.split(oldStr);
  if (max === -1 || segments.length - 1 <= max) {
    return segments.join(new_);
  }
  const head = segments.slice(0, max + 1).join(new_);
  const tail = segments.slice(max + 1).join(oldStr);
  return head + oldStr + tail;
};

const title = createStringFilter((s: string): string => pipe(s, split(' '), map((word: string) => capitalize(word) as string), joinRemeda(' ')));

const trim = createStringFilter((s: string): string => s.replace(/^\s*|\s*$/gu, ''));

/** Jinja2's `truncate` filter defaults to 255 characters. */
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

const urlencode = (obj: unknown): string => {
  const enc = encodeURIComponent;
  if (typeof obj === 'string') { return enc(obj); }
  const keyvals = Array.isArray(obj)
    ? (obj as [string, unknown][])
    : entries(obj as Record<string, unknown>);
  return pipe(keyvals, map(([k, v]) => `${enc(k)}=${enc(String(v))}`), joinRemeda('&'));
};

export { capitalize, fallback, escape, tojson, indent, joinFilter as join, lower, replace, title, trim, truncate, upper, urlencode };
