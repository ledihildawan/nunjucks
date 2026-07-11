import { isArray, entries } from 'remeda';
import {
  normalize,
  capitalize,
  center,
  default_,
  dump,
  escape,
  safe,
  forceescape,
  indent,
  join,
  lower,
  nl2br,
  replace,
  string,
  striptags,
  title,
  trim,
  truncate,
  upper,
  urlencode,
  urlize,
  wordcount,
} from '../filters/string.js';
import {
  batch,
  first,
  last,
  lengthFilter,
  list,
  random,
  reverse,
  slice,
  sum,
  sort,
  reject,
  select,
  rejectattr,
  selectattr,
} from '../filters/array.js';
import {
  dictsort,
  groupby,
} from '../filters/object.js';
import {
  abs,
  isNaN,
  round,
  float,
  intFilter,
} from '../filters/math.js';
import {
  callable,
  defined,
  divisibleby,
  escaped,
  equalto,
  eq,
  sameas,
  even,
  falsy,
  ge,
  greaterthan,
  gt,
  le,
  lessthan,
  lt,
  isLowerCase,
  ne,
  nullTest,
  number,
  odd,
  isString,
  truthy,
  undefinedTest,
  isUpperCase,
  iterable,
  mapping,
} from './built-in-tests.js';
import globals from './globals.js';

export const createBuiltIns = () => ({
  globals: globals(),
  filters: {},
  tests: {},
  asyncFilters: [],
  extensions: {},
  extensionsList: []
});

export const normalizeLoaders = (loaders, FileSystemLoader) => {
  if (!loaders) {
    if (FileSystemLoader) return [new FileSystemLoader('views')];
    return [];
  }
  return isArray(loaders) ? loaders : [loaders];
};

const allFilters = {
  normalize,
  capitalize,
  center,
  default_,
  dump,
  escape,
  safe,
  forceescape,
  indent,
  join,
  lower,
  nl2br,
  replace,
  string,
  striptags,
  title,
  trim,
  truncate,
  upper,
  urlencode,
  urlize,
  wordcount,
  batch,
  first,
  last,
  list,
  random,
  reverse,
  slice,
  sum,
  sort,
  reject,
  select,
  rejectattr,
  selectattr,
  dictsort,
  groupby,
  abs,
  isNaN,
  round,
  float,
  default: default_,
  length: lengthFilter,
  int: intFilter,
  d: default_,
  e: escape,
};

const allTests = {
  callable,
  defined,
  divisibleby,
  escaped,
  equalto,
  eq,
  sameas,
  even,
  falsy,
  ge,
  greaterthan,
  gt,
  le,
  lessthan,
  lt,
  lower: isLowerCase,
  ne,
  nullTest,
  null: nullTest,
  number,
  odd,
  string: isString,
  truthy,
  undefinedTest,
  undefined: undefinedTest,
  upper: isUpperCase,
  iterable,
  mapping,
};

export const registerBuiltIns = (env) => {
  env.globals = globals();
  env.filters = {};
  env.tests = {};
  env.asyncFilters = [];
  env.extensions = {};
  env.extensionsList = [];

  entries(allFilters).forEach(([name, filter]) => env.addFilter(name, filter));
  entries(allTests).forEach(([name, test]) => env.addTest(name, test));
};
