import { defaultTo } from 'remeda';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { normalize, safeString, safeHtml, preserveSafe, createStringFilter, createMacroFilter, isSafeString, isArray, filterError } from '../factory/index.ts';
import type { SafeString } from '../factory/index.ts';

export { normalize, filterError } from '../factory/index.ts';

export const capitalize = createStringFilter((s: string): string => {
  const ret = s.toLowerCase();
  return `${ret.charAt(0).toUpperCase()}${ret.slice(1)}`;
});

export const fallback = createMacroFilter(['val', 'def', 'bool'], (val: unknown, def: unknown, bool?: boolean): unknown => {
  if (bool) {
    return val || def;
  }
  if (val === null || val === undefined) {
    return def;
  }
  return val;
});

// biome-ignore lint/suspicious/noShadowRestrictedNames: `escape` is the public name of this Nunjucks filter; renaming it would break every template that uses it.
export const escape = safeHtml;

export const tojson = (value: unknown): SafeString => safeString(JSON.stringify(value));

/** Jinja2's `indent` filter defaults to four spaces. */
const DEFAULT_INDENT_WIDTH = 4;

export const indent = (str: unknown, width?: number, indentfirst?: boolean): string => {
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

export const join = (arr: unknown, del?: string, attr?: string): string => {
  if (!isArray(arr)) {
    const errorDef = ERROR_DEFINITIONS.JOIN_FILTER;
    if (errorDef) {
      throw filterError(undefined, errorDef, { type: typeof arr }, typeof arr);
    }
    throw new Error(`Expected array but got ${typeof arr}`);
  }
  const d = defaultTo(del, '');
  if (attr) {
    arr = arr.map((v) => (v as Record<string, unknown>)[attr]);
  }
  return (arr as unknown[]).join(d);
};

export const lower = createStringFilter((s: string): string => s.toLowerCase());

export const replace = (str: unknown, old: unknown, new_: string, maxCount?: number): string => {
  const originalStr = str;
  if (old instanceof RegExp) { return (str as string).replace(old, new_); }
  let max: number;
  if (maxCount === undefined) {
    max = -1;
  } else {
    max = maxCount;
  }
  if (typeof old === 'number') { old = String(old); }
  else if (typeof old !== 'string') { return str as string; }
  let s: string;
  if (typeof str === 'number') { s = String(str); }
  else if (typeof str === 'string' || isSafeString(str)) { s = str as string; }
  else { return str as string; }
  const oldStr = old as string;
  if (oldStr === '') { return preserveSafe(originalStr, new_ + s.split('').join(new_) + new_); }
  const nextIndex = s.indexOf(oldStr);
  if (max === 0 || nextIndex === -1) { return s; }
  const parts: string[] = [];
  let pos = 0;
  let count = 0;
  let currentIndex = nextIndex;
  while (currentIndex > -1 && (max === -1 || count < max)) {
    parts.push(s.slice(pos, currentIndex), new_);
    pos = currentIndex + oldStr.length;
    count += 1;
    currentIndex = s.indexOf(oldStr, pos);
  }
  parts.push(s.slice(pos));
  return preserveSafe(originalStr, parts.join(''));
};

export const title = createStringFilter((s: string): string => {
  const words = s.split(' ').map((word: string) => capitalize(word));
  return (words as string[]).join(' ');
});

export const trim = createStringFilter((s: string): string => s.replace(/^\s*|\s*$/gu, ''));

/** Jinja2's `truncate` filter defaults to 255 characters. */
const DEFAULT_TRUNCATE_LENGTH = 255;

export const truncate = (input: unknown, length?: number, killwords?: boolean, end?: string): string => {
  const orig = input;
  let inp = normalize(input, '');
  if (typeof inp !== 'string') { inp = String(inp); }
  const len = defaultTo(length, DEFAULT_TRUNCATE_LENGTH);
  if (inp.length <= len) { return inp; }
  if (killwords) {
    inp = inp.slice(0, len);
  } else {
    let idx = inp.lastIndexOf(' ', len);
    if (idx === -1) { idx = len; }
    inp = inp.slice(0, idx);
  }
  inp += defaultTo(end, '...');
  return preserveSafe(orig, inp);
};

export const upper = createStringFilter((s: string): string => s.toUpperCase());

export const urlencode = (obj: unknown): string => {
  const enc = encodeURIComponent;
  if (typeof obj === 'string') { return enc(obj); }
  let keyvals: [string, unknown][];
  if (Array.isArray(obj)) {
    keyvals = obj as [string, unknown][];
  } else {
    keyvals = Object.entries(obj as Record<string, unknown>);
  }
  return keyvals.map(([k, v]) => `${enc(k)}=${enc(String(v))}`).join('&');
};
