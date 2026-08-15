import { BUILTIN_FILTERS, type DomPurifyConfig } from '@nunjucks/filters';
import type { FilterBundle } from './config/global.ts';

// WHY: the built-in filter surface (incl. upstream aliases) is defined ONCE in
// @nunjucks/filters filter-names.ts — this bundle only freezes it into engine defaults.
const defaultFilterBundle: FilterBundle = Object.freeze({
  filters: BUILTIN_FILTERS,
  dompurify: Object.freeze({}),
});

export type { DomPurifyConfig, FilterBundle };
export { defaultFilterBundle };
