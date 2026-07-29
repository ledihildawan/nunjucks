import { getNodeTypeName } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { filter, forEach, keys, pipe } from 'remeda';

const ExpressionSecurityError = {
  DYNAMIC_PROPERTY_ACCESS: 'DYNAMIC_PROPERTY_ACCESS',
  DANGEROUS_BRACKET_ACCESS: 'DANGEROUS_BRACKET_ACCESS',
  UNSAFE_PROPERTY: 'UNSAFE_PROPERTY',
};

const DEFAULT_SECURITY_CONFIG = {
  allowDynamicPropertyAccess: false,
  allowConstructorAccess: false,
  allowPrototypeAccess: false,
  blockedPropertyPatterns: [
    /^__/,
    /constructor$/,
    /prototype$/,
  ],
};

/** Node bookkeeping fields, not child nodes to walk into. */
const NON_CHILD_KEYS = new Set(['lineno', 'colno', 'fields']);

const DANGEROUS_PROPERTIES = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
  'eval',
  'execScript',
]);

interface ValidationError {
  code: string;
  message: string;
  path: (string | number)[];
  lineno: number;
  colno: number;
}

const DANGEROUS_CALLEES = new Set(['eval', 'Function', 'execScript']);

/** The property being looked up, when it is written as a symbol or a string literal. */
const staticPropertyName = (val: Node | null | undefined): string | null => {
  if (!val) { return null; }
  const valType = getNodeTypeName(val);
  if (valType === 'symbol') { return val.value as string; }
  if (valType === 'literal' && typeof val.value === 'string') { return val.value; }
  return null;
};

const unsafeProperty = (
  message: string,
  node: Node,
  path: (string | number)[]
): ValidationError => ({
  code: ExpressionSecurityError.UNSAFE_PROPERTY,
  message,
  path,
  lineno: node.lineno,
  colno: node.colno,
});

/** `a.b` / `a['b']` where the property is one we refuse to let templates reach. */
const checkLookupVal = (node: Node, path: (string | number)[], blocked: RegExp[]): ValidationError[] => {
  const propName = staticPropertyName(node.val as Node);
  if (!propName) { return []; }

  const where = [...path, 'lookupVal'];
  return [
    ...(DANGEROUS_PROPERTIES.has(propName)
      ? [unsafeProperty(`Access to dangerous property '${propName}' is not allowed`, node, where)]
      : []),
    ...(blocked.some(pattern => pattern.test(propName))
      ? [unsafeProperty(`Property '${propName}' matches blocked pattern`, node, where)]
      : []),
  ];
};

const checkSymbol = (node: Node, path: (string | number)[]): ValidationError[] => {
  const name = node.value as string;
  if (!DANGEROUS_PROPERTIES.has(name)) { return []; }
  return [unsafeProperty(`Dangerous symbol '${name}' is not allowed`, node, [...path, 'symbol'])];
};

/** A direct call to eval and friends, written as `eval(...)` or `x | eval`. */
const checkCall = (node: Node, nodeType: string, path: (string | number)[]): ValidationError[] => {
  const name = node.name as Node;
  if (!name || getNodeTypeName(name) !== 'symbol') { return []; }
  const fnName = name.value as string;
  if (!DANGEROUS_CALLEES.has(fnName)) { return []; }
  return [unsafeProperty(`Dangerous function call '${fnName}' is not allowed`, node, [...path, nodeType])];
};

const walkChildNodes = (
  node: Record<string, unknown>,
  errors: ValidationError[],
  cfg: Record<string, unknown>,
  path: (string | number)[]
): void => {
  pipe(
    keys(node),
    filter(k => !NON_CHILD_KEYS.has(k)),
    forEach(key => {
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach((c, i) => { walk(c as Node, errors, cfg, [...path, key, i]); });
      } else if (child && typeof child === 'object') {
        walk(child as Node, errors, cfg, [...path, key]);
      }
    })
  );
};

const walk = (
  node: Node | null | undefined,
  errors: ValidationError[],
  cfg: Record<string, unknown>,
  path: (string | number)[] = []
): void => {
  if (!node) { return; }

  const nodeType = getNodeTypeName(node);

  switch (nodeType) {
    case 'lookupVal': {
      errors.push(...checkLookupVal(node, path, cfg.blockedPropertyPatterns as RegExp[]));
      walk(node.target as Node, errors, cfg, [...path, 'target']);
      walk(node.val as Node, errors, cfg, [...path, 'val']);
      break;
    }

    case 'symbol': {
      errors.push(...checkSymbol(node, path));
      break;
    }

    case 'funCall':
    case 'pipe': {
      errors.push(...checkCall(node, nodeType ?? '', path));
      walk(node.name as Node, errors, cfg, [...path, 'name']);
      walk(node.args as Node, errors, cfg, [...path, 'args']);
      break;
    }

    default: {
      walkChildNodes(node as Record<string, unknown>, errors, cfg, path);
    }
  }
};

function validateExpression(ast: Node, config: Record<string, unknown> = {}): ValidationError[] {
  const cfg = { ...DEFAULT_SECURITY_CONFIG, ...config };
  const errors: ValidationError[] = [];
  walk(ast, errors, cfg);
  return errors;
}

function isExpressionSafe(ast: Node, config: Record<string, unknown> = {}): boolean {
  const errors = validateExpression(ast, config);
  return errors.length === 0;
}

export { ExpressionSecurityError, DEFAULT_SECURITY_CONFIG, validateExpression, isExpressionSafe };
