export const RESERVED_KEYWORDS = new Set([
  'if', 'elif', 'else', 'endif',
  'for', 'endfor', 'in',
  'block', 'endblock', 'extends', 'super',
  'include', 'import', 'from', 'as',
  'macro', 'endmacro', 'call', 'endcall',
  'set', 'endset',
  'filter', 'endfilter',
  'raw', 'endraw', 'verbatim', 'endverbatim',
  'switch', 'case', 'default', 'endswitch',
  'break', 'continue',
  'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
  'Math', 'JSON', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise',
  'Symbol', 'Error', 'TypeError', 'RangeError', 'SyntaxError',
  'Function', 'eval', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'undefined', 'null', 'true', 'false',
  'range', 'cycler', 'joiner', 'namespace', 'log', 'debug',
  'tuple', 'async', 'await', 'var', 'let', 'const',
  'loop', 'super', 'caller', 'include', 'import',
  'safe', 'new', 'delete', 'typeof', 'instanceof',
  'this', 'self', 'window', 'global', 'globalThis', 'process',
  'console', 'exports', 'module', 'require', '__dirname', '__filename',
  'constructor', 'prototype', '__proto__', 'hasOwnProperty',
  'toString', 'valueOf', 'toJSON',
  'dump', 'inspect', 'toJson', 'safe', 'escape', 'Markup',
  'default', 'defaultFilter', 'first', 'last', 'batch',
  'list', 'join', 'sort', 'reverse', 'length', 'items',
  'keys', 'values', 'replace', 'truncate', 'wordwrap', 'striptags',
  'title', 'upper', 'lower', 'center', 'format',
  'pprint', 'sum', 'min', 'max', 'groupby', 'round', 'random',
  'truncatewords', 'strip', 'urlize', 'wordcount', 'string',
  'stringify', 'slice',
  'concat', 'merge', 'pick', 'omit', 'groupBy', 'sortBy',
  'where', 'reject', 'map', 'pluck', 'invoke', 'call',
  'attr', 'dumpObj', 'copySafeness', 'markSafe'
]);

export const validateReservedName = (name, type = 'name') => {
  if (RESERVED_KEYWORDS.has(name)) {
    return {
      valid: false,
      error: {
        code: 'RESERVED_KEYWORD',
        subject: name,
        type,
        message: `Cannot use reserved ${type} '${name}'`
      }
    };
  }
  return { valid: true };
};

export const validateFilterName = (name) => validateReservedName(name, 'filter');

export const validateGlobalName = (name) => validateReservedName(name, 'global');

export const validateContextKey = (key) => validateReservedName(key, 'context key');

export const getReservedKeywords = () => [...RESERVED_KEYWORDS];
