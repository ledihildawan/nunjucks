import * as arrayFilters from './filters/array.ts';
import * as mathFilters from './filters/math.ts';
import * as objectFilters from './filters/object.ts';
import * as selectFilters from './filters/select.ts';
import * as stringFilters from './filters/string.ts';
import * as urlEncodeFilters from './filters/url-encode.ts';

// WHY: upstream-compat aliases — kept so templates written for nunjucks 3.x keep working.
// Spread into BUILTIN_FILTERS below so alias names are part of the engine's filter
// registration (core filter-bundle) and the reserved-name list (shared BUILTIN_FILTER_NAMES).
// `length` needs no alias entry: the array module exports it under its public name, so the
// module spread registers it (the old internal-name leak registered `lengthFilter` too).
const FILTER_ALIASES: Readonly<Record<string, unknown>> = Object.freeze({
  default: stringFilters.fallback,
  d: stringFilters.fallback,
  e: stringFilters.escape,
});

/**
 * Assembles the builtin filter registry under its reserved names, folding in
 * the 3.x compat aliases; the shared `BUILTIN_FILTER_NAMES` tuple is the
 * drift-pin for the exact key set.
 */
// WHY: sanitize deliberately absent — it lives on the ./sanitize subpath (opt-in
// security shell) so the jsdom-backed DOMPurify dependency never enters the barrel.
const BUILTIN_FILTERS: Readonly<Record<string, unknown>> = Object.freeze({
  ...arrayFilters,
  ...mathFilters,
  ...objectFilters,
  ...selectFilters,
  ...stringFilters,
  ...urlEncodeFilters,
  ...FILTER_ALIASES,
});

export { BUILTIN_FILTERS };
