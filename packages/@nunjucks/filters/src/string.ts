import { isString, isArray, map, entries, defaultTo, isNonNullish, isNullish, isNumber, pipe, filter } from 'remeda';
import { isSafeString, markSafe, copySafeness } from '@nunjucks/runtime';
import { escapeHtml } from '@nunjucks/shared';

export function normalize(value: unknown, defaultValue: string): string {
  if (isNullish(value) || value === false) {
    return defaultValue;
  }
  return value as string;
}

export function capitalize(str: unknown): unknown {
  const s = normalize(str, '');
  const ret = s.toLowerCase();
  return copySafeness(str as object, `${ret.charAt(0).toUpperCase()}${ret.slice(1)}`);
}

export function center(str: unknown, width?: number): unknown {
  const s = normalize(str, '');
  const w = defaultTo(width, 80);

  if (s.length >= w) {
    return s;
  }

  const spaces = w - s.length;
  const pre = ' '.repeat(Math.round((spaces / 2) - (spaces % 2)));
  const post = ' '.repeat(Math.round(spaces / 2));
  return copySafeness(str as object, `${pre}${s}${post}`);
}

export function fallback(val: unknown, def: unknown, bool?: boolean): unknown {
  if (bool) {
    return val || def;
  } else {
    return (val === undefined) ? def : val;
  }
}

export function dump(obj: unknown, spaces?: number): string {
  return JSON.stringify(obj, null, spaces);
}

export function escape(str: unknown): unknown {
  if (isSafeString(str)) {
    return str;
  }
  const s = isNonNullish(str) ? String(str) : '';
  return markSafe(escapeHtml(s));
}

export function safe(str: unknown): unknown {
  if (isSafeString(str)) {
    return str;
  }
  const s = isNonNullish(str) ? String(str) : '';
  return markSafe(s);
}

export function forceescape(str: unknown): unknown {
  const s = isNonNullish(str) ? String(str) : '';
  return markSafe(escapeHtml(s));
}

export function indent(str: unknown, width?: number, indentfirst?: boolean): unknown {
  const s = normalize(str, '');

  if (s === '') {
    return '';
  }

  const w = defaultTo(width, 4);
  const lines = s.split('\n');
  const sp = ' '.repeat(Math.round(w));

  const res = lines.map((l, i) => {
    return (i === 0 && !indentfirst) ? l : `${sp}${l}`;
  }).join('\n');

  return copySafeness(str as object, res);
}

export function join(arr: unknown[], del?: string, attr?: string): string {
  const d = defaultTo(del, '');

  if (attr) {
    arr = map(arr as Record<string, unknown>[], (v) => v[attr]);
  }

  return (arr as unknown[]).join(d);
}

export function lower(str: unknown): string {
  const s = normalize(str, '');
  return s.toLowerCase();
}

export function nl2br(str: unknown): unknown {
  if (!isNonNullish(str)) {
    return '';
  }
  const s = str as string;
  return copySafeness(str as object, s.replace(/\r\n|\n/g, '<br />\n'));
}

export function replace(str: unknown, old: unknown, new_: string, maxCount?: number): unknown {
  const originalStr = str;

  if (old instanceof RegExp) {
    return (str as string).replace(old, new_);
  }

  const max = maxCount === undefined ? -1 : maxCount;

  if (isNumber(old)) {
    old = String(old);
  } else if (!isString(old)) {
    return str;
  }

  let s: string;
  if (isNumber(str)) {
    s = String(str);
  } else if (isString(str) || isSafeString(str)) {
    s = str as string;
  } else {
    return str;
  }

  const oldStr = old as string;

  if (oldStr === '') {
    const res = new_ + s.split('').join(new_) + new_;
    return copySafeness(originalStr as object, res);
  }

  let nextIndex = s.indexOf(oldStr);
  if (max === 0 || nextIndex === -1) {
    return s;
  }

  let res = '';
  let pos = 0;
  let count = 0;

  while (nextIndex > -1 && (max === -1 || count < max)) {
    res += s.substring(pos, nextIndex) + new_;
    pos = nextIndex + oldStr.length;
    count++;
    nextIndex = s.indexOf(oldStr, pos);
  }

  if (pos < s.length) {
    res += s.substring(pos);
  }

  return copySafeness(originalStr as object, res);
}

export function string(obj: unknown): unknown {
  return copySafeness(obj, obj as { toString(): string });
}

export function striptags(input: unknown, preserveLinebreaks?: boolean): unknown {
  const inp = normalize(input, '');
  const tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>|<!--[\s\S]*?-->/gi;
  const trimmedInput = trim(inp.replace(tags, '')) as unknown as string;
  let res: string;
  if (preserveLinebreaks) {
    res = trimmedInput
      .replace(/^ +| +$/gm, '')
      .replace(/ +/g, ' ')
      .replace(/(\r\n)/g, '\n')
      .replace(/\n\n\n+/g, '\n\n');
  } else {
    res = trimmedInput.replace(/\s+/gi, ' ');
  }
  return copySafeness(input as object, res);
}

export function title(str: unknown): unknown {
  const s = normalize(str, '');
  const words = s.split(' ').map(word => capitalize(word));
  return copySafeness(str as object, (words as string[]).join(' '));
}

export function trim(str: unknown): unknown {
  const s = String(str ?? '');
  return copySafeness(str as object, s.replace(/^\s*|\s*$/g, ''));
}

export function truncate(input: unknown, length?: number, killwords?: boolean, end?: string): unknown {
  const orig = input;
  let inp = normalize(input, '');
  if (typeof inp !== 'string') inp = String(inp);
  const len = defaultTo(length, 255);

  if (inp.length <= len) {
    return inp;
  }

  if (killwords) {
    inp = inp.substring(0, len);
  } else {
    let idx = inp.lastIndexOf(' ', len);
    if (idx === -1) {
      idx = len;
    }

    inp = inp.substring(0, idx);
  }

  inp += defaultTo(end, '...');
  return copySafeness(orig as object, inp);
}

export function upper(str: unknown): string {
  const s = normalize(str, '');
  return s.toUpperCase();
}

export function urlencode(obj: unknown): string {
  const enc = encodeURIComponent;
  if (isString(obj)) {
    return enc(obj);
  } else {
    const keyvals = (isArray(obj)) ? (obj as [string, unknown][]) : entries(obj as Record<string, unknown>);
    return keyvals.map(([k, v]) => `${enc(k)}=${enc(String(v))}`).join('&');
  }
}

const puncRe = /^(?:\(|<|&lt;)?(.*?)(?:\.|,|\)|\n|&gt;)?$/;
const emailRe = /^[\w.!#$%&'*+\-/=?^`{|}~]+@[a-z\d-]+(\.[a-z\d-]+)+$/i;
const httpHttpsRe = /^https?:\/\/.*$/;
const wwwRe = /^www\./;
const tldRe = /\.(?:org|net|com)(?::|\/|$)/;

export function urlize(str: string, length?: number, nofollow?: boolean): string {
  let len = length;
  if (isNaN(len as number)) {
    len = Infinity;
  }

  const noFollowAttr = (nofollow === true ? ' rel="nofollow"' : '');

  const processWord = (word: string): string => {
    const matches = word.match(puncRe);
    const possibleUrl = (matches && matches[1]) ? matches[1] : word;
    const shortUrl = possibleUrl.substring(0, len);

    if (httpHttpsRe.test(possibleUrl)) {
      return `<a href="${possibleUrl}"${noFollowAttr}>${shortUrl}</a>`;
    }

    if (wwwRe.test(possibleUrl)) {
      return `<a href="http://${possibleUrl}"${noFollowAttr}>${shortUrl}</a>`;
    }

    if (emailRe.test(possibleUrl)) {
      return `<a href="mailto:${possibleUrl}">${possibleUrl}</a>`;
    }

    if (tldRe.test(possibleUrl)) {
      return `<a href="http://${possibleUrl}"${noFollowAttr}>${shortUrl}</a>`;
    }

    return word;
  };

  const words = pipe(
    str.split(/(\s+)/),
    filter((word: string) => word.length > 0),
    map(processWord)
  );

  return (words as string[]).join('');
}

export function wordcount(str: unknown): number | null {
  const s = normalize(str, '');
  const words = (s) ? s.match(/\w+/g) : null;
  return (words) ? words.length : null;
}
