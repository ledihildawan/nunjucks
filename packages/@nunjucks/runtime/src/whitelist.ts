import type { Node } from '@nunjucks/nodes';

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

type AstNode = Record<string, unknown>;

const validateTag = (allowedTagSet: Set<string>, blockedTagSet: Set<string>, strict: boolean, tagName: string): boolean => {
  if (allowedTagSet.has(tagName)) { return true; }
  if (blockedTagSet.has(tagName)) { return false; }
  if (strict && !allowedTagSet.has(tagName)) { return false; }
  return !strict;
};

/** The filter policy: fixed for the lifetime of a whitelist, unlike the name being checked. */
interface FilterPolicy {
  dangerous: Set<string>;
  allowed: Set<string>;
  blocked: Set<string>;
  strict: boolean;
}

const validateFilter = (policy: FilterPolicy, filterName: string): boolean => {
  if (policy.dangerous.has(filterName)) { return false; }
  if (policy.allowed.has(filterName)) { return true; }
  if (policy.blocked.has(filterName)) { return false; }
  if (policy.strict && !policy.allowed.has(filterName)) { return false; }
  return !policy.strict;
};

const traverseAst = (node: unknown, callback: (node: Node) => void): void => {
  if (!node || typeof node !== 'object') { return; }

  const nodeObj = node as AstNode;
  // Whitelist scanning intentionally supports legacy structural AST input.
  if (typeof nodeObj.type === 'string') { callback(nodeObj as unknown as Node); }

  if (nodeObj.children && Array.isArray(nodeObj.children)) {
    for (const child of nodeObj.children as unknown[]) { traverseAst(child, callback); }
  }

  if (nodeObj.body) {
    if (Array.isArray(nodeObj.body)) {
      for (const child of nodeObj.body as unknown[]) { traverseAst(child, callback); }
    } else {
      traverseAst(nodeObj.body, callback);
    }
  }

  if (nodeObj.alternate) {
    traverseAst(nodeObj.alternate, callback);
  }

  if (nodeObj.test) {
    traverseAst(nodeObj.test, callback);
  }

  if (nodeObj.expr) {
    traverseAst(nodeObj.expr, callback);
  }

  if (nodeObj.name) {
    traverseAst(nodeObj.name, callback);
  }

  if (nodeObj.args && Array.isArray(nodeObj.args)) {
    for (const child of nodeObj.args as unknown[]) { traverseAst(child, callback); }
  }

  if (nodeObj.target) {
    traverseAst(nodeObj.target, callback);
  }
};

export interface WhitelistError extends Error {
  code: string;
}

export interface WhitelistValidatorOptions {
  allowedTags?: string[] | null;
  allowedFilters?: string[] | null;
  blockedTags?: string[] | null;
  blockedFilters?: string[] | null;
  strict?: boolean;
}

export interface WhitelistValidator {
  validateTag: (tagName: string) => boolean;
  validateFilter: (filterName: string) => boolean;
  isTagAllowed: (tagName: string) => boolean;
  isFilterAllowed: (filterName: string) => boolean;
  getAllowedTags: () => string[];
  getAllowedFilters: () => string[];
  options: { allowedTags: string[]; allowedFilters: string[]; strict: boolean };
}

export const createWhitelistError = (message: string, code = 'WHITELIST_VIOLATION'): WhitelistError => {
  const err = new Error(message) as WhitelistError;
  err.name = 'WhitelistError';
  err.code = code;
  return err;
};

export const createWhitelistValidator = (options: WhitelistValidatorOptions = {}): WhitelistValidator => {
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
  let blockedTagSet: Set<string>;
  if (blockedTags) {
    blockedTagSet = new Set(blockedTags);
  } else {
    blockedTagSet = new Set<string>();
  }
  let blockedFilterSet: Set<string>;
  if (blockedFilters) {
    blockedFilterSet = new Set(blockedFilters);
  } else {
    blockedFilterSet = new Set<string>();
  }

  return {
    validateTag: (tagName: string): boolean => validateTag(allowedTagSet, blockedTagSet, strict, tagName),
    validateFilter: (filterName: string): boolean => validateFilter({ dangerous: DANGEROUS_FILTERS, allowed: allowedFilterSet, blocked: blockedFilterSet, strict }, filterName),
    isTagAllowed: (tagName: string): boolean => validateTag(allowedTagSet, blockedTagSet, strict, tagName),
    isFilterAllowed: (filterName: string): boolean => validateFilter({ dangerous: DANGEROUS_FILTERS, allowed: allowedFilterSet, blocked: blockedFilterSet, strict }, filterName),
    getAllowedTags: (): string[] => [...allowedTagSet],
    getAllowedFilters: (): string[] => [...allowedFilterSet],
    options: { allowedTags: tags, allowedFilters: filters, strict }
  };
};

export const scanASTForTags = (ast: AstNode | Node | null | undefined, callback: (node: Node) => void): void => {
  if (!ast) { return; }
  traverseAst(ast, callback);
};

export interface TemplateWhitelistViolation {
  type: 'tag';
  name: string;
  lineno: number;
  colno: number;
}

export interface TemplateWhitelistResult {
  valid: boolean;
  violations: TemplateWhitelistViolation[];
}

export const validateTemplateWhitelist = (
  ast: AstNode | Node,
  validator: WhitelistValidator
): TemplateWhitelistResult => {
  const violations: TemplateWhitelistViolation[] = [];

  scanASTForTags(ast, (node) => {
    const nodeType = node.type;

    if ((nodeType === 'block' || nodeType === 'extends' || nodeType === 'include' || nodeType === 'import') && !validator.isTagAllowed(nodeType)) {
        violations.push({
          type: 'tag',
          name: nodeType,
          lineno: node.lineno,
          colno: node.colno
        });
      }
  });

  return {
    valid: violations.length === 0,
    violations
  };
};
