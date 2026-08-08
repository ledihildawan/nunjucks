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

export type ExpressionValidationResult =
  | { valid: true; errors: readonly [] }
  | { valid: false; errors: readonly [ExpressionValidationError, ...ExpressionValidationError[]] };

const DANGEROUS_CALLEES: ReadonlySet<string> = new Set(CODE_EXECUTION_KEYS);

const staticPropertyName = (value: Node | null | undefined): string | null => {
  if (!value) { return null; }
  if (isSymbol(value)) { return value.value; }
  if (getNodeTypeName(value) === 'literal' && typeof value.value === 'string') { return value.value; }
  return null;
};

interface UnsafePropertyInput {
  message: string;
  node: Node;
  path: readonly (string | number)[];
}

const unsafeProperty = ({ message, node, path }: UnsafePropertyInput): ExpressionValidationError => ({
  code: ExpressionSecurityError.UNSAFE_PROPERTY,
  message,
  path,
  lineno: node.lineno,
  colno: node.colno,
});

const createExpressionWalker = (blocked: readonly RegExp[]) => {
  const checkLookupVal = (node: LookupNode, path: readonly (string | number)[]): ExpressionValidationError[] => {
    const propName = staticPropertyName(node.val);
    if (!propName) { return []; }

    const where = [...path, 'lookupVal'];
    return [
      ...(DANGEROUS_PROPERTIES.has(propName)
        ? [unsafeProperty({ message: `Access to dangerous property '${propName}' is not allowed`, node, path: where })]
        : []),
      ...(blocked.some(pattern => pattern.test(propName))
        ? [unsafeProperty({ message: `Property '${propName}' matches blocked pattern`, node, path: where })]
        : []),
    ];
  };

  const checkSymbol = (node: SymbolNode, path: readonly (string | number)[]): ExpressionValidationError[] => {
    const name = node.value;
    if (!DANGEROUS_PROPERTIES.has(name)) { return []; }
    return [unsafeProperty({ message: `Dangerous symbol '${name}' is not allowed`, node, path: [...path, 'symbol'] })];
  };

  const checkCall = (node: CallNode, path: readonly (string | number)[]): ExpressionValidationError[] => {
    const name = node.name;
    if (!isSymbol(name)) { return []; }
    const fnName = name.value;
    if (!DANGEROUS_CALLEES.has(fnName)) { return []; }
    return [unsafeProperty({ message: `Dangerous function call '${fnName}' is not allowed`, node, path: [...path, node.type] })];
  };

  const walkChildNodes = (node: Node, path: readonly (string | number)[]): ExpressionValidationError[] =>
    flatMap(
      Object.entries(node).filter(([key]) => !NON_CHILD_KEYS.has(key)),
      ([key, child]) => {
        if (Array.isArray(child)) {
          return flatMap(child, (element, i) => isNode(element) ? walk(element, [...path, key, i]) : []);
        }
        if (isNode(child)) {
          return walk(child, [...path, key]);
        }
        return [];
      },
    );

  const walk = (node: Node | null | undefined, path: readonly (string | number)[]): ExpressionValidationError[] => {
    if (!node) { return []; }

    switch (node.type) {
      case 'lookupVal':
        return [
          ...checkLookupVal(node, path),
          ...walk(node.target, [...path, 'target']),
          ...walk(node.val, [...path, 'val']),
        ];

      case 'symbol':
        return checkSymbol(node, path);

      case 'funCall':
      case 'pipe':
        return [
          ...checkCall(node, path),
          ...walk(node.name, [...path, 'name']),
          ...flatMap(node.args, (arg, i) => walk(arg, [...path, 'args', i])),
        ];

      default:
        return walkChildNodes(node, path);
    }
  };

  return walk;
};

const validateExpression = (ast: Node, config: ExpressionSecurityConfig = {}): ExpressionValidationResult => {
  const blocked = config.blockedPropertyPatterns ?? DEFAULT_SECURITY_CONFIG.blockedPropertyPatterns;
  const walk = createExpressionWalker(blocked);
  const errors = walk(ast, []);
  if (errors.length === 0) {
    return { valid: true, errors: [] as const };
  }
  return { valid: false, errors: errors as [ExpressionValidationError, ...ExpressionValidationError[]] };
};

export { ExpressionSecurityError, validateExpression };
