import * as stringFilters from '@nunjucks/filters';
import * as arrayFilters from '@nunjucks/filters';
import * as objectFilters from '@nunjucks/filters';
import * as mathFilters from '@nunjucks/filters';
import { sanitize, type DomPurifyConfig } from '@nunjucks/filters';
import type { FilterBundle } from './config/global.ts';

const builtInFilters = Object.freeze({
  ...stringFilters,
  ...arrayFilters,
  ...objectFilters,
  ...mathFilters,
  default: stringFilters.fallback,
  d: stringFilters.fallback,
  e: stringFilters.escape,
  length: arrayFilters.lengthFilter,
  tojson: stringFilters.tojson,
  sanitize,
});

const defaultFilterBundle: FilterBundle = Object.freeze({
  filters: builtInFilters,
  dompurify: Object.freeze({}),
});

export { defaultFilterBundle };
export type { DomPurifyConfig, FilterBundle };
