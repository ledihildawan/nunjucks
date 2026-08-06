import { getNodeTypeName, isNode, isSymbol } from '@nunjucks/nodes';
import type { Node, LookupNode, CallNode, SymbolNode } from '@nunjucks/nodes';
import { OBJECT_INTRINSICS, CODE_EXECUTION_KEYS } from '@nunjucks/shared';

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
} as const;

export type ExpressionSecurityConfig = {
  allowDynamicPropertyAccess?: boolean;
  allowConstructorAccess?: boolean;
  allowPrototypeAccess?: boolean;
  blockedPropertyPatterns?: readonly RegExp[];
};

/** Node bookkeeping fields, not child nodes to walk into. */
const NON_CHILD_KEYS = new Set(['lineno', 'colno', 'fields']);

/** Single source of truth: object intrinsics (constructor, __proto__, ...) shared with the runtime sandbox. */
const DANGEROUS_PROPERTIES: ReadonlySet<string> = new Set(OBJECT_INTRINSICS);

interface ValidationError {
  code: string;
  message: string;
  path: readonly (string | number)[];
  lineno: number;
  colno: number;
}

/** Single source of truth: code-execution callees (eval, Function, ...) shared with the runtime sandbox. */
const DANGEROUS_CALLEES: ReadonlySet<string> = new Set(CODE_EXECUTION_KEYS);

/** The property being looked up, when it is written as a symbol or a string literal. */
const staticPropertyName = (val: Node | null | undefined): string | null => {
  if (!val) { return null; }
  if (isSymbol(val)) { return val.value; }
  if (getNodeTypeName(val) === 'literal' && typeof val.value === 'string') { return val.value; }
  return null;
};

const unsafeProperty = (
  message: string,
  node: Node,
  path: readonly (string | number)[]
): ValidationError => ({
  code: ExpressionSecurityError.UNSAFE_PROPERTY,
  message,
  path,
  lineno: node.lineno,
  colno: node.colno,
});

/** `a.b` / `a['b']` where the property is one we refuse to let templates reach. */
const checkLookupVal = (node: LookupNode, path: readonly (string | number)[], blocked: readonly RegExp[]): ValidationError[] => {
  const propName = staticPropertyName(node.val);
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

const checkSymbol = (node: SymbolNode, path: readonly (string | number)[]): ValidationError[] => {
  const name = node.value;
  if (!DANGEROUS_PROPERTIES.has(name)) { return []; }
  return [unsafeProperty(`Dangerous symbol '${name}' is not allowed`, node, [...path, 'symbol'])];
};

/** A direct call to eval and friends, written as `eval(...)` or `x | eval`. */
const checkCall = (node: CallNode, nodeType: string, path: readonly (string | number)[]): ValidationError[] => {
  const name = node.name;
  if (!isSymbol(name)) { return []; }
  const fnName = name.value;
  if (!DANGEROUS_CALLEES.has(fnName)) { return []; }
  return [unsafeProperty(`Dangerous function call '${fnName}' is not allowed`, node, [...path, nodeType])];
};

const walkChildNodes = (
  node: Node,
  errors: ValidationError[],
  cfg: ExpressionSecurityConfig,
  path: readonly (string | number)[]
): void => {
  for (const key of Object.keys(node)) {
    if (NON_CHILD_KEYS.has(key)) { continue; }
    const child = Reflect.get(node, key);
    if (Array.isArray(child)) {
      child.forEach((c, i) => {
        if (isNode(c)) { walk(c, errors, cfg, [...path, key, i]); }
      });
    } else if (isNode(child)) {
      walk(child, errors, cfg, [...path, key]);
    }
  }
};

const walk = (
  node: Node | null | undefined,
  errors: ValidationError[],
  cfg: ExpressionSecurityConfig,
  path: readonly (string | number)[]
): void => {
  if (!node) { return; }

  switch (node.type) {
    case 'lookupVal': {
      errors.push(...checkLookupVal(node, path, cfg.blockedPropertyPatterns ?? []));
      walk(node.target, errors, cfg, [...path, 'target']);
      walk(node.val, errors, cfg, [...path, 'val']);
      break;
    }

    case 'symbol': {
      errors.push(...checkSymbol(node, path));
      break;
    }

    case 'funCall':
    case 'pipe': {
      errors.push(...checkCall(node, node.type, path));
      walk(node.name, errors, cfg, [...path, 'name']);
      for (const [i, a] of node.args.entries()) {
        walk(a, errors, cfg, [...path, 'args', i]);
      }
      break;
    }

    default: {
      walkChildNodes(node, errors, cfg, path);
    }
  }
};

const validateExpression = (ast: Node, config: ExpressionSecurityConfig = {}): ValidationError[] => {
  const cfg = { ...DEFAULT_SECURITY_CONFIG, ...config };
  const errors: ValidationError[] = [];
  walk(ast, errors, cfg, []);
  return errors;
};

export { ExpressionSecurityError, DEFAULT_SECURITY_CONFIG, validateExpression };
export type { ValidationError };
