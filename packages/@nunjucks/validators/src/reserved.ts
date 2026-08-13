import { BLOCKED_KEYS_LIST } from './security/index.ts';
import { ok, err, type Result } from '@nunjucks/lib';

const RESERVED_KEYWORDS = new Set<string>([
  'if', 'elif', 'else', 'endif',
  'for', 'endfor', 'in',
  'block', 'endblock', 'extends', 'super',
  'include', 'import', 'from', 'as',
  'component', 'endcomponent', 'render', 'endrender', 'slot', 'endslot',
  'filter', 'endfilter',
  'raw', 'endraw', 'verbatim', 'endverbatim',
  'switch', 'case', 'default', 'endswitch',
  'scope', 'endscope',
  'exec',
  'break', 'continue',
  'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
  'Math', 'JSON', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise',
  'Symbol', 'Error', 'TypeError', 'RangeError', 'SyntaxError',
  'Function', 'eval', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'undefined', 'null', 'true', 'false',
  'range', 'cycler', 'joiner', 'namespace', 'log', 'debug',
  'tuple', 'async', 'await', 'var', 'let', 'const',
  'loop',
  'safe', 'new', 'delete', 'typeof', 'instanceof',
  'this', 'self', 'window', 'global', 'globalThis', 'process',
  'console', 'exports', 'module', 'require', '__dirname', '__filename',
  'constructor', 'prototype', '__proto__', 'hasOwnProperty',
  'toString', 'valueOf', 'toJSON',
  'dump', 'inspect', 'toJson', 'escape', 'Markup',
  'defaultFilter', 'first', 'last', 'batch',
  'list', 'join', 'sort', 'reverse', 'length', 'items',
  'keys', 'values', 'replace', 'truncate', 'wordwrap', 'striptags',
  'title', 'upper', 'lower', 'center', 'format',
  'pprint', 'sum', 'min', 'max', 'groupby', 'round', 'random',
  'truncatewords', 'strip', 'urlize', 'wordcount', 'string',
  'stringify', 'slice',
  'concat', 'merge', 'pick', 'omit', 'groupBy', 'sortBy',
  'where', 'reject', 'map', 'pluck', 'invoke',
  'attr', 'dumpObj', 'copySafeness', 'markSafe',
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
      message: `Cannot use reserved ${type} '${name}'`
    });
  }
  return ok(undefined);
};

const validateFilterName = (name: string): Result<void, ReservedNameError> => validateReservedName(name, 'filter');

const validateGlobalName = (name: string): Result<void, ReservedNameError> => validateReservedName(name, 'global');

const getReservedKeywords = (): string[] => [...RESERVED_KEYWORDS];

export { RESERVED_KEYWORDS, validateFilterName, validateGlobalName, getReservedKeywords };
export type { ReservedNameError };
