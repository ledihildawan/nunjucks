import { ERROR_CODES } from '@nunjucks/error-catalog';
import { err, ok, type Result } from '@nunjucks/lib';
import { BLOCKED_KEYS_LIST, BUILTIN_FILTER_NAMES } from '@nunjucks/shared';
import { JS_BUILTIN_CONSTRUCTORS } from './js-builtins.ts';

/**
 * Frozen catalog of names unavailable to user-defined filters, globals, and
 * tests: parser statement tags, JS builtin constructors, shared blocked keys,
 * and built-in filter names. Entries are sourced from their canonical lists
 * (see the WHY comments inline) so this set cannot drift from the parser or
 * filter registry.
 */
const RESERVED_KEYWORDS: ReadonlySet<string> = new Set<string>([
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
  // WHY: built-in filter names come from the static shared list — kept in sync with the
  // real filter registry by filters/src/filter-names.test.ts, so adding a filter there
  // fails that drift pin until the name is registered in shared and thus reserved here.
  ...BUILTIN_FILTER_NAMES,
  ...BLOCKED_KEYS_LIST,
]);

interface ReservedNameError {
  code: string;
  subject: string;
  type: string;
  message: string;
}

/** Rejects a name that collides with `RESERVED_KEYWORDS`, tagged by `type`. */
const validateReservedName = (name: string, type = 'name'): Result<void, ReservedNameError> => {
  if (RESERVED_KEYWORDS.has(name)) {
    return err({
      code: ERROR_CODES.RESERVED_KEYWORD,
      subject: name,
      type,
      message: `Cannot use reserved ${type} '${name}'`,
    });
  }
  return ok(undefined);
};

/** Rejects custom filter names that shadow reserved or builtin filters. */
const validateFilterName = (name: string): Result<void, ReservedNameError> =>
  validateReservedName(name, 'filter');

/** Rejects custom global names that shadow reserved or builtin globals. */
const validateGlobalName = (name: string): Result<void, ReservedNameError> =>
  validateReservedName(name, 'global');

/** Returns a fresh array of all reserved keywords; mutating it cannot affect the live set. */
const getReservedKeywords = (): string[] => [...RESERVED_KEYWORDS];

export type { ReservedNameError };
export { getReservedKeywords, RESERVED_KEYWORDS, validateFilterName, validateGlobalName };
