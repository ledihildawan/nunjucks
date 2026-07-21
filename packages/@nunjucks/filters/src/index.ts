import * as stringFilters from './string.ts';
import * as arrayFilters from './array.ts';
import * as objectFilters from './object.ts';
import * as mathFilters from './math.ts';

export * from './string.ts';
export * from './array.ts';
export * from './object.ts';
export * from './math.ts';

export const filters = {
  capitalize: stringFilters.capitalize,
  center: stringFilters.center,
  default: stringFilters.fallback,
  dump: stringFilters.dump,
  escape: stringFilters.escape,
  safe: stringFilters.safe,
  forceescape: stringFilters.forceescape,
  indent: stringFilters.indent,
  join: stringFilters.join,
  lower: stringFilters.lower,
  nl2br: stringFilters.nl2br,
  replace: stringFilters.replace,
  string: stringFilters.string,
  striptags: stringFilters.striptags,
  title: stringFilters.title,
  trim: stringFilters.trim,
  truncate: stringFilters.truncate,
  upper: stringFilters.upper,
  urlencode: stringFilters.urlencode,
  urlize: stringFilters.urlize,
  wordcount: stringFilters.wordcount,

  batch: arrayFilters.batch,
  first: arrayFilters.first,
  last: arrayFilters.last,
  list: arrayFilters.list,
  random: arrayFilters.random,
  reverse: arrayFilters.reverse,
  slice: arrayFilters.slice,
  sum: arrayFilters.sumFilter,
  sort: arrayFilters.sortFilter,
  reject: arrayFilters.reject,
  select: arrayFilters.select,
  rejectattr: arrayFilters.rejectattr,
  selectattr: arrayFilters.selectattr,
  dictsort: objectFilters.dictsort,
  groupby: objectFilters.groupby,

  abs: mathFilters.abs,
  isNaN: mathFilters.isNaN,
  round: mathFilters.round,
  float: mathFilters.float,
  int: mathFilters.intFilter,
  length: arrayFilters.lengthFilter,

  normalize: stringFilters.normalize,
  fallback: stringFilters.fallback,
  d: stringFilters.fallback,
  e: stringFilters.escape,
};
