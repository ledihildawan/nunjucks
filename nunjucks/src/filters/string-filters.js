import { isString, isArray, map, entries } from 'remeda';
import { SafeString, markSafe, copySafeness } from '../runtime/index.js';

export function normalize(value, defaultValue) {
  if (value === null || value === undefined || value === false) {
    return defaultValue;
  }
  return value;
}

export function capitalize(str) {
  str = normalize(str, '');
  const ret = str.toLowerCase();
  return copySafeness(str, ret.charAt(0).toUpperCase() + ret.slice(1));
}

export function center(str, width) {
  str = normalize(str, '');
  width = width || 80;

  if (str.length >= width) {
    return str;
  }

  const spaces = width - str.length;
  const pre = ' '.repeat(Math.round((spaces / 2) - (spaces % 2)));
  const post = ' '.repeat(Math.round(spaces / 2));
  return copySafeness(str, pre + str + post);
}

export function default_(val, def, bool) {
  if (bool) {
    return val || def;
  } else {
    return (val !== undefined) ? val : def;
  }
}

export function dump(obj, spaces) {
  return JSON.stringify(obj, null, spaces);
}

export function escape(str) {
  if (str instanceof SafeString) {
    return str;
  }
  str = (str === null || str === undefined) ? '' : str;
  return markSafe(Bun.escapeHTML(str.toString()).replace(/\\/g, '&#92;'));
}

export function safe(str) {
  if (str instanceof SafeString) {
    return str;
  }
  str = (str === null || str === undefined) ? '' : str;
  return markSafe(str.toString());
}

export function forceescape(str) {
  str = (str === null || str === undefined) ? '' : str;
  return markSafe(Bun.escapeHTML(str.toString()).replace(/\\/g, '&#92;'));
}

export function indent(str, width, indentfirst) {
  str = normalize(str, '');

  if (str === '') {
    return '';
  }

  width = width || 4;
  const lines = str.split('\n');
  const sp = ' '.repeat(Math.round(width));

  const res = lines.map((l, i) => {
    return (i === 0 && !indentfirst) ? l : `${sp}${l}`;
  }).join('\n');

  return copySafeness(str, res);
}

export function join(arr, del, attr) {
  del = del || '';

  if (attr) {
    arr = map(arr, (v) => v[attr]);
  }

  return arr.join(del);
}

export function lower(str) {
  str = normalize(str, '');
  return str.toLowerCase();
}

export function nl2br(str) {
  if (str === null || str === undefined) {
    return '';
  }
  return copySafeness(str, str.replace(/\r\n|\n/g, '<br />\n'));
}

export function replace(str, old, new_, maxCount) {
  var originalStr = str;

  if (old instanceof RegExp) {
    return str.replace(old, new_);
  }

  if (typeof maxCount === 'undefined') {
    maxCount = -1;
  }

  let res = '';

  if (typeof old === 'number') {
    old = '' + old;
  } else if (typeof old !== 'string') {
    return str;
  }

  if (typeof str === 'number') {
    str = '' + str;
  }

  if (typeof str !== 'string' && !(str instanceof SafeString)) {
    return str;
  }

  if (old === '') {
    res = new_ + str.split('').join(new_) + new_;
    return copySafeness(str, res);
  }

  let nextIndex = str.indexOf(old);
  if (maxCount === 0 || nextIndex === -1) {
    return str;
  }

  let pos = 0;
  let count = 0;

  while (nextIndex > -1 && (maxCount === -1 || count < maxCount)) {
    res += str.substring(pos, nextIndex) + new_;
    pos = nextIndex + old.length;
    count++;
    nextIndex = str.indexOf(old, pos);
  }

  if (pos < str.length) {
    res += str.substring(pos);
  }

  return copySafeness(originalStr, res);
}

export function string(obj) {
  return copySafeness(obj, obj);
}

export function striptags(input, preserveLinebreaks) {
  input = normalize(input, '');
  let tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>|<!--[\s\S]*?-->/gi;
  let trimmedInput = trim(input.replace(tags, ''));
  let res = '';
  if (preserveLinebreaks) {
    res = trimmedInput
      .replace(/^ +| +$/gm, '')
      .replace(/ +/g, ' ')
      .replace(/(\r\n)/g, '\n')
      .replace(/\n\n\n+/g, '\n\n');
  } else {
    res = trimmedInput.replace(/\s+/gi, ' ');
  }
  return copySafeness(input, res);
}

export function title(str) {
  str = normalize(str, '');
  let words = str.split(' ').map(word => capitalize(word));
  return copySafeness(str, words.join(' '));
}

export function trim(str) {
  return copySafeness(str, str.replace(/^\s*|\s*$/g, ''));
}

export function truncate(input, length, killwords, end) {
  var orig = input;
  input = normalize(input, '');
  length = length || 255;

  if (input.length <= length) {
    return input;
  }

  if (killwords) {
    input = input.substring(0, length);
  } else {
    let idx = input.lastIndexOf(' ', length);
    if (idx === -1) {
      idx = length;
    }

    input = input.substring(0, idx);
  }

  input += (end !== undefined && end !== null) ? end : '...';
  return copySafeness(orig, input);
}

export function upper(str) {
  str = normalize(str, '');
  return str.toUpperCase();
}

export function urlencode(obj) {
  var enc = encodeURIComponent;
  if (isString(obj)) {
    return enc(obj);
  } else {
    let keyvals = (isArray(obj)) ? obj : entries(obj);
    return keyvals.map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&');
  }
}

const puncRe = /^(?:\(|<|&lt;)?(.*?)(?:\.|,|\)|\n|&gt;)?$/;
const emailRe = /^[\w.!#$%&'*+\-/=?^`{|}~]+@[a-z\d-]+(\.[a-z\d-]+)+$/i;
const httpHttpsRe = /^https?:\/\/.*$/;
const wwwRe = /^www\./;
const tldRe = /\.(?:org|net|com)(?::|\/|$)/;

export function urlize(str, length, nofollow) {
  if (isNaN(length)) {
    length = Infinity;
  }

  const noFollowAttr = (nofollow === true ? ' rel="nofollow"' : '');

  const words = str.split(/(\s+)/).filter((word) => {
    return word && word.length;
  }).map((word) => {
    var matches = word.match(puncRe);
    var possibleUrl = (matches) ? matches[1] : word;
    var shortUrl = possibleUrl.substr(0, length);

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
  });

  return words.join('');
}

export function wordcount(str) {
  str = normalize(str, '');
  const words = (str) ? str.match(/\w+/g) : null;
  return (words) ? words.length : null;
}
