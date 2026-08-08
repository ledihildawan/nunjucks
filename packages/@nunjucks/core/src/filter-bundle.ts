import * as filters from '@nunjucks/filters';
import { sanitize, type DomPurifyConfig } from '@nunjucks/filters';
import type { FilterBundle } from './config/global.ts';

const builtInFilters = Object.freeze({
  ...filters,
  default: filters.fallback,
  d: filters.fallback,
  e: filters.escape,
  length: filters.lengthFilter,
  tojson: filters.tojson,
  sanitize,
});

const defaultFilterBundle: FilterBundle = Object.freeze({
  filters: builtInFilters,
  dompurify: Object.freeze({}),
});

export { defaultFilterBundle };
export type { DomPurifyConfig, FilterBundle };
