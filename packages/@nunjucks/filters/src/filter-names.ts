import * as arrayFilters from './filters/array.ts';
import * as mathFilters from './filters/math.ts';
import * as objectFilters from './filters/object.ts';
import * as sanitizeFilters from './filters/sanitize.ts';
import * as stringFilters from './filters/string.ts';
import * as urlEncodeFilters from './filters/url-encode.ts';

// WHY: upstream-compat aliases — kept so templates written for nunjucks 3.x keep working.
// Spread into BUILTIN_FILTERS below so alias names are part of both the engine's filter
// registration (core filter-bundle) and the reserved-name list (validators) via one map.
const FILTER_ALIASES: Readonly<Record<string, unknown>> = Object.freeze({
  default: stringFilters.fallback,
  d: stringFilters.fallback,
  e: stringFilters.escape,
  length: arrayFilters.lengthFilter,
});

const BUILTIN_FILTERS: Readonly<Record<string, unknown>> = Object.freeze({
  ...arrayFilters,
  ...mathFilters,
  ...objectFilters,
  ...sanitizeFilters,
  ...stringFilters,
  ...urlEncodeFilters,
  ...FILTER_ALIASES,
});

const BUILTIN_FILTER_NAMES: readonly string[] = Object.keys(BUILTIN_FILTERS);

export { BUILTIN_FILTER_NAMES, BUILTIN_FILTERS };
