export class WhitelistError extends Error {
  constructor(message, code = 'WHITELIST_VIOLATION') {
    super(message);
    this.name = 'WhitelistError';
    this.code = code;
  }
}

const DEFAULT_ALLOWED_TAGS = [
  'for',
  'if',
  'else',
  'elif',
  'endif',
  'set',
  'block',
  'endblock',
  'extends',
  'include',
  'macro',
  'endmacro',
  'call',
  'endcall',
  'filter',
  'endfilter',
  'from',
  'import',
  'raw',
  'endraw',
  'with',
  'endwith',
  'do'
];

const DEFAULT_ALLOWED_FILTERS = [
  'abs',
  'attr',
  'batch',
  'capitalize',
  'center',
  'default',
  'dictsort',
  'escape',
  'filesizeformat',
  'first',
  'float',
  'forceescape',
  'format',
  'groupby',
  'indent',
  'int',
  'join',
  'last',
  'length',
  'list',
  'lower',
  'min',
  'max',
  'pprint',
  'random',
  'reject',
  'rejectattr',
  'replace',
  'reverse',
  'round',
  'safe',
  'select',
  'selectattr',
  'slice',
  'sort',
  'string',
  'striptags',
  'sum',
  'title',
  'trim',
  'truncate',
  'upper',
  'urlize',
  'wordcount',
  'wordwrap',
  'xmlattr'
];

const DANGEROUS_FILTERS = new Set([
  'eval',
  'exec',
  'compile'
]);

export const createWhitelistValidator = (options = {}) => {
  const {
    allowedTags = null,
    allowedFilters = null,
    blockedTags = null,
    blockedFilters = null,
    strict = false
  } = options;

  const tags = allowedTags || DEFAULT_ALLOWED_TAGS;
  const filters = allowedFilters || DEFAULT_ALLOWED_FILTERS;

  const allowedTagSet = new Set(tags);
  const allowedFilterSet = new Set(filters);
  const blockedTagSet = blockedTags ? new Set(blockedTags) : new Set();
  const blockedFilterSet = blockedFilters ? new Set(blockedFilters) : new Set();

  const validateTag = (tagName) => {
    if (allowedTagSet.has(tagName)) return true;
    if (blockedTagSet.has(tagName)) return false;
    if (strict && !allowedTagSet.has(tagName)) return false;
    return !strict;
  };

  const validateFilter = (filterName) => {
    if (DANGEROUS_FILTERS.has(filterName)) return false;
    if (allowedFilterSet.has(filterName)) return true;
    if (blockedFilterSet.has(filterName)) return false;
    if (strict && !allowedFilterSet.has(filterName)) return false;
    return !strict;
  };

  return {
    validateTag,
    validateFilter,
    isTagAllowed: (tagName) => validateTag(tagName),
    isFilterAllowed: (filterName) => validateFilter(filterName),
    getAllowedTags: () => [...allowedTagSet],
    getAllowedFilters: () => [...allowedFilterSet],
    options: { allowedTags: tags, allowedFilters: filters, strict }
  };
};

export const scanASTForTags = (ast, callback) => {
  if (!ast) return;

  const traverse = (node) => {
    if (!node || typeof node !== 'object') return;

    if (node.type) {
      callback(node);
    }

    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }

    if (node.body) {
      if (Array.isArray(node.body)) {
        node.body.forEach(traverse);
      } else {
        traverse(node.body);
      }
    }

    if (node.alternate) {
      traverse(node.alternate);
    }

    if (node.test) {
      traverse(node.test);
    }

    if (node.expr) {
      traverse(node.expr);
    }

    if (node.name) {
      traverse(node.name);
    }

    if (node.args && Array.isArray(node.args)) {
      node.args.forEach(traverse);
    }

    if (node.target) {
      traverse(node.target);
    }
  };

  traverse(ast);
};

export const validateTemplateWhitelist = (ast, validator) => {
  const violations = [];

  scanASTForTags(ast, (node) => {
    const nodeType = node.type;

    if (nodeType === 'block' || nodeType === 'extends' || nodeType === 'include' || nodeType === 'import') {
      if (!validator.isTagAllowed(nodeType)) {
        violations.push({
          type: 'tag',
          name: nodeType,
          lineno: node.lineno,
          colno: node.colno
        });
      }
    }
  });

  return {
    valid: violations.length === 0,
    violations
  };
};
