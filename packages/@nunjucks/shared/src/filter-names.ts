// WHY: static registry of built-in filter names (including upstream-compat aliases) — lives
// in @nunjucks/shared so validators can reserve these names without importing the
// @nunjucks/filters barrel. `sanitize` is deliberately absent: it ships on the opt-in
// `@nunjucks/filters/sanitize` subpath, so the name stays free for hosts that register it.
// Drift is pinned by filters/src/filter-names.test.ts, which asserts this list matches
// Object.keys(BUILTIN_FILTERS) exactly — adding a filter without updating this list fails
// that test, so no hand-maintained list can silently drift.
const BUILTIN_FILTER_NAMES: readonly string[] = Object.freeze([
  'first',
  'last',
  'lengthFilter',
  'reverse',
  'slice',
  'sort',
  'sum',
  'abs',
  'round',
  'groupby',
  'capitalize',
  'escape',
  'fallback',
  'indent',
  'join',
  'lower',
  'replace',
  'title',
  'tojson',
  'trim',
  'truncate',
  'upper',
  'urlencode',
  'default',
  'd',
  'e',
  'length',
]);

export { BUILTIN_FILTER_NAMES };
