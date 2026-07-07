import * as lib from './lib/index.js';
import { TemplateError } from './error/index.js';
import * as r from './runtime.js';

export function normalize(value, defaultValue) {
  if (value === null || value === undefined || value === false) {
    return defaultValue;
  }
  return value;
}

export const abs = Math.abs;

export function isNaN(num) {
  return num !== num;
}

export function batch(arr, linecount, fillWith) {
  var i;
  var res = [];
  var tmp = [];

  for (i = 0; i < arr.length; i++) {
    if (i % linecount === 0 && tmp.length) {
      res.push(tmp);
      tmp = [];
    }

    tmp.push(arr[i]);
  }

  if (tmp.length) {
    if (fillWith) {
      for (i = tmp.length; i < linecount; i++) {
        tmp.push(fillWith);
      }
    }

    res.push(tmp);
  }

  return res;
}

export function capitalize(str) {
  str = normalize(str, '');
  const ret = str.toLowerCase();
  return r.copySafeness(str, ret.charAt(0).toUpperCase() + ret.slice(1));
}

export function center(str, width) {
  str = normalize(str, '');
  width = width || 80;

  if (str.length >= width) {
    return str;
  }

  const spaces = width - str.length;
  const pre = lib.repeat(' ', (spaces / 2) - (spaces % 2));
  const post = lib.repeat(' ', spaces / 2);
  return r.copySafeness(str, pre + str + post);
}

export function default_(val, def, bool) {
  if (bool) {
    return val || def;
  } else {
    return (val !== undefined) ? val : def;
  }
}

export function dictsort(val, caseSensitive, by) {
  if (!lib.isObject(val)) {
    throw new TemplateError('dictsort filter: val must be an object');
  }

  let array = [];
  for (let k in val) {
    array.push([k, val[k]]);
  }

  let si;
  if (by === undefined || by === 'key') {
    si = 0;
  } else if (by === 'value') {
    si = 1;
  } else {
    throw new TemplateError(
      'dictsort filter: You can only sort by either key or value');
  }

  array.sort((t1, t2) => {
    var a = t1[si];
    var b = t2[si];

    if (!caseSensitive) {
      if (lib.isString(a)) {
        a = a.toUpperCase();
      }
      if (lib.isString(b)) {
        b = b.toUpperCase();
      }
    }

    return a > b ? 1 : (a === b ? 0 : -1);
  });

  return array;
}

export function dump(obj, spaces) {
  return JSON.stringify(obj, null, spaces);
}

export function escape(str) {
  if (str instanceof r.SafeString) {
    return str;
  }
  str = (str === null || str === undefined) ? '' : str;
  return r.markSafe(lib.escape(str.toString()));
}

export function safe(str) {
  if (str instanceof r.SafeString) {
    return str;
  }
  str = (str === null || str === undefined) ? '' : str;
  return r.markSafe(str.toString());
}

export function first(arr) {
  return arr[0];
}

export function forceescape(str) {
  str = (str === null || str === undefined) ? '' : str;
  return r.markSafe(lib.escape(str.toString()));
}

export function groupby(arr, attr) {
  return lib.groupBy(arr, attr, this.env.opts.throwOnUndefined);
}

export function indent(str, width, indentfirst) {
  str = normalize(str, '');

  if (str === '') {
    return '';
  }

  width = width || 4;
  const lines = str.split('\n');
  const sp = lib.repeat(' ', width);

  const res = lines.map((l, i) => {
    return (i === 0 && !indentfirst) ? l : `${sp}${l}`;
  }).join('\n');

  return r.copySafeness(str, res);
}

export function join(arr, del, attr) {
  del = del || '';

  if (attr) {
    arr = lib.map(arr, (v) => v[attr]);
  }

  return arr.join(del);
}

export function last(arr) {
  return arr[arr.length - 1];
}

export function lengthFilter(val) {
  var value = normalize(val, '');

  if (value !== undefined) {
    if (
      (typeof Map === 'function' && value instanceof Map) ||
      (typeof Set === 'function' && value instanceof Set)
    ) {
      return value.size;
    }
    if (lib.isObject(value) && !(value instanceof r.SafeString)) {
      return lib.keys(value).length;
    }
    return value.length;
  }
  return 0;
}

export function list(val) {
  if (lib.isString(val)) {
    return val.split('');
  } else if (lib.isObject(val)) {
    return lib._entries(val || {}).map(([key, value]) => ({key, value}));
  } else if (lib.isArray(val)) {
    return val;
  } else {
    throw new TemplateError('list filter: type not iterable');
  }
}

export function lower(str) {
  str = normalize(str, '');
  return str.toLowerCase();
}

export function nl2br(str) {
  if (str === null || str === undefined) {
    return '';
  }
  return r.copySafeness(str, str.replace(/\r\n|\n/g, '<br />\n'));
}

export function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getSelectOrReject(expectedTestResult) {
  function filter(arr, testName = 'truthy', secondArg) {
    const context = this;
    const test = context.env.getTest(testName);

    return lib.toArray(arr).filter(function examineTestResult(item) {
      return test.call(context, item, secondArg) === expectedTestResult;
    });
  }

  return filter;
}

export const reject = getSelectOrReject(false);

export function rejectattr(arr, attr) {
  return arr.filter((item) => !item[attr]);
}

export const select = getSelectOrReject(true);

export function selectattr(arr, attr) {
  return arr.filter((item) => !!item[attr]);
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

  if (typeof str !== 'string' && !(str instanceof r.SafeString)) {
    return str;
  }

  if (old === '') {
    res = new_ + str.split('').join(new_) + new_;
    return r.copySafeness(str, res);
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

  return r.copySafeness(originalStr, res);
}

export function reverse(val) {
  var arr;
  if (lib.isString(val)) {
    arr = list(val);
  } else {
    arr = lib.map(val, v => v);
  }

  arr.reverse();

  if (lib.isString(val)) {
    return r.copySafeness(val, arr.join(''));
  }
  return arr;
}

export function round(val, precision, method) {
  precision = precision || 0;
  const factor = Math.pow(10, precision);
  let rounder;

  if (method === 'ceil') {
    rounder = Math.ceil;
  } else if (method === 'floor') {
    rounder = Math.floor;
  } else {
    rounder = Math.round;
  }

  return rounder(val * factor) / factor;
}

export function slice(arr, slices, fillWith) {
  const sliceLength = Math.floor(arr.length / slices);
  const extra = arr.length % slices;
  const res = [];
  let offset = 0;

  for (let i = 0; i < slices; i++) {
    const start = offset + (i * sliceLength);
    if (i < extra) {
      offset++;
    }
    const end = offset + ((i + 1) * sliceLength);

    const currSlice = arr.slice(start, end);
    if (fillWith && i >= extra) {
      currSlice.push(fillWith);
    }
    res.push(currSlice);
  }

  return res;
}

export function sum(arr, attr, start = 0) {
  if (attr) {
    arr = lib.map(arr, (v) => v[attr]);
  }

  return start + arr.reduce((a, b) => a + b, 0);
}

export const sort = r.makeMacro(
  ['value', 'reverse', 'case_sensitive', 'attribute'], [],
  function sortFilter(arr, reversed, caseSens, attr) {
    let array = lib.map(arr, v => v);
    let getAttribute = lib.getAttrGetter(attr);

    array.sort((a, b) => {
      let x = (attr) ? getAttribute(a) : a;
      let y = (attr) ? getAttribute(b) : b;

      if (
        this.env.opts.throwOnUndefined &&
        attr && (x === undefined || y === undefined)
      ) {
        throw new TypeError(`sort: attribute "${attr}" resolved to undefined`);
      }

      if (!caseSens && lib.isString(x) && lib.isString(y)) {
        x = x.toLowerCase();
        y = y.toLowerCase();
      }

      if (x < y) {
        return reversed ? 1 : -1;
      } else if (x > y) {
        return reversed ? -1 : 1;
      } else {
        return 0;
      }
    });

    return array;
  });

export function string(obj) {
  return r.copySafeness(obj, obj);
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
  return r.copySafeness(input, res);
}

export function title(str) {
  str = normalize(str, '');
  let words = str.split(' ').map(word => capitalize(word));
  return r.copySafeness(str, words.join(' '));
}

export function trim(str) {
  return r.copySafeness(str, str.replace(/^\s*|\s*$/g, ''));
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
  return r.copySafeness(orig, input);
}

export function upper(str) {
  str = normalize(str, '');
  return str.toUpperCase();
}

export function urlencode(obj) {
  var enc = encodeURIComponent;
  if (lib.isString(obj)) {
    return enc(obj);
  } else {
    let keyvals = (lib.isArray(obj)) ? obj : lib._entries(obj);
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

export function float(val, def) {
  var res = parseFloat(val);
  return (isNaN(res)) ? def : res;
}

export const intFilter = r.makeMacro(
  ['value', 'default', 'base'],
  [],
  function doInt(value, defaultValue, base = 10) {
    var res = parseInt(value, base);
    return (isNaN(res)) ? defaultValue : res;
  }
);

export const d = default_;
export const e = escape;

export { default_ as default };
export { lengthFilter as length };
export { intFilter as int };
