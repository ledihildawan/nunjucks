import { err, ok, type Result } from '@nunjucks/lib';
import { BLOCKED_KEYS_LIST } from '@nunjucks/shared';
import { JS_BUILTIN_CONSTRUCTORS } from './js-builtins.ts';

const RESERVED_KEYWORDS = new Set<string>([
  'if',
  'elif',
  'else',
  'endif',
  'for',
  'endfor',
  'in',
  'block',
  'endblock',
  'extends',
  'super',
  'include',
  'import',
  'from',
  'as',
  'component',
  'endcomponent',
  'render',
  'endrender',
  'slot',
  'endslot',
  'filter',
  'endfilter',
  'raw',
  'endraw',
  'verbatim',
  'endverbatim',
  'switch',
  'case',
  'default',
  'endswitch',
  'scope',
  'endscope',
  'exec',
  'break',
  'continue',
  ...JS_BUILTIN_CONSTRUCTORS,
  'Function',
  'eval',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'undefined',
  'null',
  'true',
  'false',
  'range',
  'cycler',
  'joiner',
  'namespace',
  'log',
  'debug',
  'tuple',
  'async',
  'await',
  'var',
  'let',
  'const',
  'loop',
  'safe',
  'new',
  'delete',
  'typeof',
  'instanceof',
  'this',
  'self',
  'window',
  'global',
  'globalThis',
  'process',
  'console',
  'exports',
  'module',
  'require',
  '__dirname',
  '__filename',
  'constructor',
  'prototype',
  '__proto__',
  'hasOwnProperty',
  'toString',
  'valueOf',
  'toJSON',
  // WHY: filter names mirror the ACTUAL built-in filter surface (filter implementations in
  // @nunjucks/filters + the default/d/e/length aliases wired in core/src/filter-bundle.ts).
  // Drift is guarded by core/src/filter-bundle.test.ts, which fails when a built-in filter
  // name is missing from this list.
  'default',
  'd',
  'e',
  'abs',
  'capitalize',
  'escape',
  'fallback',
  'first',
  'groupby',
  'indent',
  'join',
  'last',
  'length',
  'lengthFilter',
  'lower',
  'replace',
  'reverse',
  'round',
  'sanitize',
  'slice',
  'sort',
  'sum',
  'title',
  'tojson',
  'trim',
  'truncate',
  'upper',
  'urlencode',
  ...BLOCKED_KEYS_LIST,
]);

interface ReservedNameError {
  code: string;
  subject: string;
  type: string;
  message: string;
}

const validateReservedName = (name: string, type = 'name'): Result<void, ReservedNameError> => {
  if (RESERVED_KEYWORDS.has(name)) {
    return err({
      code: 'RESERVED_KEYWORD',
      subject: name,
      type,
      message: `Cannot use reserved ${type} '${name}'`,
    });
  }
  return ok(undefined);
};

const validateFilterName = (name: string): Result<void, ReservedNameError> =>
  validateReservedName(name, 'filter');

const validateGlobalName = (name: string): Result<void, ReservedNameError> =>
  validateReservedName(name, 'global');

const getReservedKeywords = (): string[] => [...RESERVED_KEYWORDS];

export type { ReservedNameError };
export { getReservedKeywords, RESERVED_KEYWORDS, validateFilterName, validateGlobalName };
