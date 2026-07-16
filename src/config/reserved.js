export const RESERVED_KEYWORDS = new Set([
  // Nunjucks template keywords
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

  // JavaScript built-ins that shouldn't be overridden
  'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
  'Math', 'JSON', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise',
  'Symbol', 'Error', 'TypeError', 'RangeError', 'SyntaxError',
  'Function', 'eval', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'undefined', 'null', 'true', 'false',

  // Nunjucks runtime globals
  'range', 'cycler', 'joiner', 'namespace', 'log', 'debug',
  'tuple', 'async', 'await', 'var', 'let', 'const',

  // Runtime functions
  'loop', 'super', 'caller', 'include', 'import',
  'safe', 'new', 'delete', 'typeof', 'instanceof',
  'this', 'self', 'window', 'global', 'globalThis', 'process',
  'console', 'exports', 'module', 'require', '__dirname', '__filename',

  // Common problematic names
  'constructor', 'prototype', '__proto__', 'hasOwnProperty',
  'toString', 'valueOf', 'toJSON',

  // Filter/function names that would conflict
  'dump', 'inspect', 'toJson', 'safe', 'escape', ' Markup',
  'default', 'defaultFilter', 'first', 'last', 'batch',
  'list', 'join', 'sort', 'reverse', 'length', 'items',
  'keys', 'values', 'replace', 'truncate', 'wordwrap', 'striptags',
  'title', 'upper', 'lower', 'center', 'format',
  'pprint', 'sum', 'min', 'max', 'groupby', 'round', 'random',
  'truncatewords', 'strip', 'urlize', 'wordcount', 'string',
  'stringify', 'slice',

  // Other built-in names
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
        message: `Cannot use reserved ${type} '${name}' - this is a reserved keyword in nunjucks`
      }
    };
  }
  return { valid: true };
};

export const validateFilterName = (name) => validateReservedName(name, 'filter');

export const validateGlobalName = (name) => validateReservedName(name, 'global');

export const validateContextKey = (key) => validateReservedName(key, 'context key');

export const getReservedKeywords = () => [...RESERVED_KEYWORDS];
