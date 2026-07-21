import type { Node } from '@nunjucks/nodes';

export interface WhitelistError extends Error {
  code: string;
}

export const createWhitelistError = (message: string, code = 'WHITELIST_VIOLATION'): WhitelistError => {
  const err = new Error(message) as WhitelistError;
  err.name = 'WhitelistError';
  err.code = code;
  return err;
};
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
  const blockedTagSet = blockedTags ? new Set(blockedTags) : new Set<string>();
  const blockedFilterSet = blockedFilters ? new Set(blockedFilters) : new Set<string>();

  const validateTag = (tagName: string): boolean => {
    if (allowedTagSet.has(tagName)) return true;
    if (blockedTagSet.has(tagName)) return false;
    if (strict && !allowedTagSet.has(tagName)) return false;
    return !strict;
  };

  const validateFilter = (filterName: string): boolean => {
    if (DANGEROUS_FILTERS.has(filterName)) return false;
    if (allowedFilterSet.has(filterName)) return true;
    if (blockedFilterSet.has(filterName)) return false;
    if (strict && !allowedFilterSet.has(filterName)) return false;
    return !strict;
  };

  return {
    validateTag,
    validateFilter,
    isTagAllowed: (tagName: string): boolean => validateTag(tagName),
    isFilterAllowed: (filterName: string): boolean => validateFilter(filterName),
    getAllowedTags: (): string[] => [...allowedTagSet],
    getAllowedFilters: (): string[] => [...allowedFilterSet],
    options: { allowedTags: tags, allowedFilters: filters, strict }
  };
};

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

export const scanASTForTags = (ast: AstNode | Node | null | undefined, callback: (node: Node) => void): void => {
  if (!ast) return;

  const traverse = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;

    const nodeObj = node as AstNode;
    if (nodeObj.type) {
      callback(nodeObj as unknown as Node);
    }

    if (nodeObj.children && Array.isArray(nodeObj.children)) {
      (nodeObj.children as unknown[]).forEach(traverse);
    }

    if (nodeObj.body) {
      if (Array.isArray(nodeObj.body)) {
        (nodeObj.body as unknown[]).forEach(traverse);
      } else {
        traverse(nodeObj.body);
      }
    }

    if (nodeObj.alternate) {
      traverse(nodeObj.alternate);
    }

    if (nodeObj.test) {
      traverse(nodeObj.test);
    }

    if (nodeObj.expr) {
      traverse(nodeObj.expr);
    }

    if (nodeObj.name) {
      traverse(nodeObj.name);
    }

    if (nodeObj.args && Array.isArray(nodeObj.args)) {
      (nodeObj.args as unknown[]).forEach(traverse);
    }

    if (nodeObj.target) {
      traverse(nodeObj.target);
    }
  };

  traverse(ast);
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
