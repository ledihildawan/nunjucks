import { defaultTo } from 'remeda';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { normalize, safeString, safeHtml, preserveSafe, createStringFilter, createMacroFilter, isSafeString, isArray, filterError } from '../factory/index.ts';
import type { SafeString } from '../factory/index.ts';

export { normalize, filterError };

export const capitalize = createStringFilter((s: string): string => {
  const ret = s.toLowerCase();
  return `${ret.charAt(0).toUpperCase()}${ret.slice(1)}`;
});

export const fallback = createMacroFilter(['val', 'def', 'bool'], (val: unknown, def: unknown, bool?: boolean): unknown =>
  bool ? (val || def) : (val == null ? def : val)
);

export const escape = safeHtml;

export const safe = safeString;

export const tojson = (value: unknown): SafeString => {
  return safeString(JSON.stringify(value));
};

export const indent = (str: unknown, width?: number, indentfirst?: boolean): string => {
  const s = normalize(str, '');
  if (s === '') return '';
  const w = defaultTo(width, 4);
  const sp = ' '.repeat(Math.round(w));
  const lines = s.split('\n');
  const res = lines.map((l: string, i: number) => (i === 0 && !indentfirst) ? l : `${sp}${l}`).join('\n');
  return preserveSafe(str, res);
};

export const join = (arr: unknown, del?: string, attr?: string): string => {
  if (!isArray(arr)) {
    throw filterError(undefined, ERROR_DEFINITIONS.JOIN_FILTER!, { type: typeof arr }, typeof arr);
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
  if (old instanceof RegExp) return (str as string).replace(old, new_);
  const max = maxCount === undefined ? -1 : maxCount;
  if (typeof old === 'number') old = String(old);
  else if (typeof old !== 'string') return str as string;
  let s: string;
  if (typeof str === 'number') s = String(str);
  else if (typeof str === 'string' || isSafeString(str)) s = str as string;
  else return str as string;
  const oldStr = old as string;
  if (oldStr === '') return preserveSafe(originalStr, new_ + s.split('').join(new_) + new_);
  let nextIndex = s.indexOf(oldStr);
  if (max === 0 || nextIndex === -1) return s;
  let res = '';
  let pos = 0;
  let count = 0;
  while (nextIndex > -1 && (max === -1 || count < max)) {
    res += s.substring(pos, nextIndex) + new_;
    pos = nextIndex + oldStr.length;
    count++;
    nextIndex = s.indexOf(oldStr, pos);
  }
  if (pos < s.length) res += s.substring(pos);
  return preserveSafe(originalStr, res);
};

export const title = createStringFilter((s: string): string => {
  const words = s.split(' ').map((word: string) => capitalize(word));
  return (words as string[]).join(' ');
});

export const trim = createStringFilter((s: string): string => s.replace(/^\s*|\s*$/g, ''));

export const truncate = (input: unknown, length?: number, killwords?: boolean, end?: string): string => {
  const orig = input;
  let inp = normalize(input, '');
  if (typeof inp !== 'string') inp = String(inp);
  const len = defaultTo(length, 255);
  if (inp.length <= len) return inp;
  if (killwords) {
    inp = inp.substring(0, len);
  } else {
    let idx = inp.lastIndexOf(' ', len);
    if (idx === -1) idx = len;
    inp = inp.substring(0, idx);
  }
  inp += defaultTo(end, '...');
  return preserveSafe(orig, inp);
};

export const upper = createStringFilter((s: string): string => s.toUpperCase());

export const urlencode = (obj: unknown): string => {
  const enc = encodeURIComponent;
  if (typeof obj === 'string') return enc(obj);
  const keyvals = Array.isArray(obj) ? (obj as [string, unknown][]) : Object.entries(obj as Record<string, unknown>);
  return keyvals.map(([k, v]) => `${enc(k)}=${enc(String(v))}`).join('&');
};
