import { err, ok, type Result } from '@nunjucks/lib';
import { BUILTIN_FILTER_NAMES } from '@nunjucks/filters';
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
  // WHY: statement-tag words (incl. end-tags and match's `when`) must mirror parser
  // STATEMENT_PARSERS — the sync is pinned by parser/src/statement-parser/registry.test.ts.
  'match',
  'when',
  'endmatch',
  'capture',
  'endcapture',
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
  // WHY: built-in filter names derive from @nunjucks/filters itself (filter-names.ts
  // includes the upstream aliases) — adding a filter there automatically reserves
  // its name here; no hand-maintained list to drift.
  ...BUILTIN_FILTER_NAMES,
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
