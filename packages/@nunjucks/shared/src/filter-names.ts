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
  'length',
  'reverse',
  'slice',
  'sort',
  'sum',
  'batch',
  'list',
  'random',
  'abs',
  'round',
  'float',
  'int',
  'groupby',
  'dictsort',
  'dump',
  'select',
  'reject',
  'selectattr',
  'rejectattr',
  'capitalize',
  'center',
  'escape',
  'fallback',
  'forceescape',
  'indent',
  'join',
  'lower',
  'nl2br',
  'replace',
  'safe',
  'string',
  'striptags',
  'title',
  'tojson',
  'trim',
  'truncate',
  'upper',
  'urlize',
  'wordcount',
  'urlencode',
  'default',
  'd',
  'e',
]);

export { BUILTIN_FILTER_NAMES };
