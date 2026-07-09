import { isArray, entries } from 'remeda';
import * as stringFilters from '../filters/string-filters.js';
import * as arrayFilters from '../filters/array-filters.js';
import * as objectFilters from '../filters/object-filters.js';
import * as mathFilters from '../filters/math-filters.js';
import * as tests from './built-in-tests.js';
import globals from '../globals.js';

export const createBuiltIns = () => ({
  globals: globals(),
  filters: {},
  tests: {},
  asyncFilters: [],
  extensions: {},
  extensionsList: []
});

export const normalizeLoaders = (loaders, FileSystemLoader, WebLoader) => {
  if (!loaders) {
    if (FileSystemLoader) return [new FileSystemLoader('views')];
    if (WebLoader) return [new WebLoader('/views')];
    return [];
  }
  return isArray(loaders) ? loaders : [loaders];
};

// All filters with their public names (handling aliases like default -> default_, length -> lengthFilter, int -> intFilter)
const allFilters = {
  ...stringFilters,
  ...arrayFilters,
  ...objectFilters,
  ...mathFilters,
  default: stringFilters.default_,
  length: arrayFilters.lengthFilter,
  int: mathFilters.intFilter,
  d: stringFilters.default_,
  e: stringFilters.escape,
};

export const registerBuiltIns = (env) => {
  env.globals = globals();
  env.filters = {};
  env.tests = {};
  env.asyncFilters = [];
  env.extensions = {};
  env.extensionsList = [];

  entries(allFilters).forEach(([name, filter]) => env.addFilter(name, filter));
  entries(tests).forEach(([name, test]) => env.addTest(name, test));
};
