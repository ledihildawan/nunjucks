import { isArray, entries } from 'remeda';
import * as filters from '../filters.js';
import * as tests from '../tests.js';
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

export const registerBuiltIns = (env) => {
  env.globals = globals();
  env.filters = {};
  env.tests = {};
  env.asyncFilters = [];
  env.extensions = {};
  env.extensionsList = [];

  entries(filters).forEach(([name, filter]) => env.addFilter(name, filter));
  entries(tests).forEach(([name, test]) => env.addTest(name, test));
};
