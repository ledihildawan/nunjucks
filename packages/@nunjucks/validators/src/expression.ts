import { getNodeTypeName, isNode, isSymbol } from '@nunjucks/nodes';
import type { Node, LookupNode, CallNode, SymbolNode } from '@nunjucks/nodes';
import { OBJECT_INTRINSICS, CODE_EXECUTION_KEYS } from '@nunjucks/shared';
import type { BaseValidationError } from '@nunjucks/shared';
import { flatMap } from 'remeda';

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

const NON_CHILD_KEYS = new Set(['lineno', 'colno', 'fields']);

const DANGEROUS_PROPERTIES: ReadonlySet<string> = new Set(OBJECT_INTRINSICS);

interface ExpressionValidationError extends BaseValidationError {
  code: string;
  path: readonly (string | number)[];
  lineno: number;
  colno: number;
}

const DANGEROUS_CALLEES: ReadonlySet<string> = new Set(CODE_EXECUTION_KEYS);

const staticPropertyName = (value: Node | null | undefined): string | null => {
  if (!value) { return null; }
  if (isSymbol(value)) { return value.value; }
  if (getNodeTypeName(value) === 'literal' && typeof value.value === 'string') { return value.value; }
  return null;
};

const unsafeProperty = (
  message: string,
  node: Node,
  path: readonly (string | number)[]
): ExpressionValidationError => ({
  code: ExpressionSecurityError.UNSAFE_PROPERTY,
  message,
  path,
  lineno: node.lineno,
  colno: node.colno,
});

const checkLookupVal = (node: LookupNode, path: readonly (string | number)[], blocked: readonly RegExp[]): ExpressionValidationError[] => {
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

const checkSymbol = (node: SymbolNode, path: readonly (string | number)[]): ExpressionValidationError[] => {
  const name = node.value;
  if (!DANGEROUS_PROPERTIES.has(name)) { return []; }
  return [unsafeProperty(`Dangerous symbol '${name}' is not allowed`, node, [...path, 'symbol'])];
};

const checkCall = (node: CallNode, nodeType: string, path: readonly (string | number)[]): ExpressionValidationError[] => {
  const name = node.name;
  if (!isSymbol(name)) { return []; }
  const fnName = name.value;
  if (!DANGEROUS_CALLEES.has(fnName)) { return []; }
  return [unsafeProperty(`Dangerous function call '${fnName}' is not allowed`, node, [...path, nodeType])];
};

const walkChildNodes = (
  node: Node,
  config: ExpressionSecurityConfig,
  path: readonly (string | number)[]
): ExpressionValidationError[] =>
  flatMap(
    Object.entries(node).filter(([key]) => !NON_CHILD_KEYS.has(key)),
    ([key, child]) => {
      if (Array.isArray(child)) {
        return flatMap(child, (c, i) => isNode(c) ? walk(c, config, [...path, key, i]) : []);
      }
      if (isNode(child)) {
        return walk(child, config, [...path, key]);
      }
      return [];
    }
  );

const walk = (
  node: Node | null | undefined,
  config: ExpressionSecurityConfig,
  path: readonly (string | number)[]
): ExpressionValidationError[] => {
  if (!node) { return []; }

  switch (node.type) {
    case 'lookupVal':
      return [
        ...checkLookupVal(node, path, config.blockedPropertyPatterns ?? []),
        ...walk(node.target, config, [...path, 'target']),
        ...walk(node.val, config, [...path, 'val']),
      ];

    case 'symbol':
      return checkSymbol(node, path);

    case 'funCall':
    case 'pipe':
      return [
        ...checkCall(node, node.type, path),
        ...walk(node.name, config, [...path, 'name']),
        ...flatMap(node.args, (a, i) => walk(a, config, [...path, 'args', i])),
      ];

    default:
      return walkChildNodes(node, config, path);
  }
};

const validateExpression = (ast: Node, config: ExpressionSecurityConfig = {}): ExpressionValidationError[] => {
  const cfg = { ...DEFAULT_SECURITY_CONFIG, ...config };
  return walk(ast, cfg, []);
};

export { ExpressionSecurityError, validateExpression };
export type { ExpressionValidationError };
