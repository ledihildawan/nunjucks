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

/** Minimal structural shape scanASTForTags/validateTemplateWhitelist rely on. */
interface AstNode {
  type?: string;
  lineno?: number;
  colno?: number;
  children?: unknown;
  body?: unknown;
  alternate?: unknown;
  test?: unknown;
  expr?: unknown;
  name?: unknown;
  args?: unknown;
  target?: unknown;
  [key: string]: unknown;
}

const validateTag = (allowedTagSet: Set<string>, blockedTagSet: Set<string>, strict: boolean, tagName: string): boolean => {
  if (allowedTagSet.has(tagName)) { return true; }
  if (blockedTagSet.has(tagName)) { return false; }
  if (strict && !allowedTagSet.has(tagName)) { return false; }
  return !strict;
};

const validateFilter = (dangerousFilters: Set<string>, allowedFilterSet: Set<string>, blockedFilterSet: Set<string>, strict: boolean, filterName: string): boolean => {
  if (dangerousFilters.has(filterName)) { return false; }
  if (allowedFilterSet.has(filterName)) { return true; }
  if (blockedFilterSet.has(filterName)) { return false; }
  if (strict && !allowedFilterSet.has(filterName)) { return false; }
  return !strict;
};

const traverseAST = (node: unknown, callback: (node: Node) => void): void => {
  if (!node || typeof node !== 'object') { return; }

  const nodeObj = node as AstNode;
  if (nodeObj.type) {
    callback(nodeObj as unknown as Node);
  }

  if (nodeObj.children && Array.isArray(nodeObj.children)) {
    (nodeObj.children as unknown[]).forEach((child) => traverseAST(child, callback));
  }

  if (nodeObj.body) {
    if (Array.isArray(nodeObj.body)) {
      (nodeObj.body as unknown[]).forEach((child) => traverseAST(child, callback));
    } else {
      traverseAST(nodeObj.body, callback);
    }
  }

  if (nodeObj.alternate) {
    traverseAST(nodeObj.alternate, callback);
  }

  if (nodeObj.test) {
    traverseAST(nodeObj.test, callback);
  }

  if (nodeObj.expr) {
    traverseAST(nodeObj.expr, callback);
  }

  if (nodeObj.name) {
    traverseAST(nodeObj.name, callback);
  }

  if (nodeObj.args && Array.isArray(nodeObj.args)) {
    (nodeObj.args as unknown[]).forEach((child) => traverseAST(child, callback));
  }

  if (nodeObj.target) {
    traverseAST(nodeObj.target, callback);
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
    validateFilter: (filterName: string): boolean => validateFilter(DANGEROUS_FILTERS, allowedFilterSet, blockedFilterSet, strict, filterName),
    isTagAllowed: (tagName: string): boolean => validateTag(allowedTagSet, blockedTagSet, strict, tagName),
    isFilterAllowed: (filterName: string): boolean => validateFilter(DANGEROUS_FILTERS, allowedFilterSet, blockedFilterSet, strict, filterName),
    getAllowedTags: (): string[] => [...allowedTagSet],
    getAllowedFilters: (): string[] => [...allowedFilterSet],
    options: { allowedTags: tags, allowedFilters: filters, strict }
  };
};

export const scanASTForTags = (ast: AstNode | Node | null | undefined, callback: (node: Node) => void): void => {
  if (!ast) { return; }
  traverseAST(ast, callback);
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
