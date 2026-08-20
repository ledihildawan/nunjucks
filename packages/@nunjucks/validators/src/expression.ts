import { err, ok, type Result } from '@nunjucks/lib';
import type { CallNode, LookupNode, Node, SymbolNode } from '@nunjucks/nodes';
import { getEnvelopeNode, getNodeTypeName, isNode, isSymbol } from '@nunjucks/nodes';
import type { BaseValidationError } from '@nunjucks/shared';
import { flatMap } from 'remeda';
import { isNonEmpty } from './is-non-empty.ts';
import {
  DANGEROUS_CALLEES,
  DANGEROUS_PROPERTIES,
  DEFAULT_SECURITY_CONFIG,
  type ExpressionSecurityConfig,
  ExpressionSecurityError,
} from './security/index.ts';

const NON_CHILD_KEYS = new Set(['lineno', 'colno', 'fields']);

/**
 * Shape of one expression-policy violation: the AST `path` where it occurred
 * plus `lineno`/`colno` source positions lifted from the offending node.
 */
export interface ExpressionValidationError extends BaseValidationError {
  code: string;
  path: readonly (string | number)[];
  lineno: number;
  colno: number;
}

/** Result envelope for expression validation; `Err` carries at least one error. */
export type ExpressionValidationResult = Result<
  void,
  readonly [ExpressionValidationError, ...ExpressionValidationError[]]
>;

const staticPropertyName = (value: Node | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  if (isSymbol(value)) {
    return value.value;
  }
  if (getNodeTypeName(value) === 'literal' && typeof value.value === 'string') {
    return value.value;
  }
  return null;
};

interface UnsafePropertyInput {
  message: string;
  node: Node;
  path: readonly (string | number)[];
}

const unsafeProperty = ({
  message,
  node,
  path,
}: UnsafePropertyInput): ExpressionValidationError => ({
  code: ExpressionSecurityError.UNSAFE_PROPERTY,
  message,
  path,
  lineno: node.lineno,
  colno: node.colno,
});

const createExpressionWalker = (blocked: readonly RegExp[]) => {
  const checkLookupVal = (
    node: LookupNode,
    path: readonly (string | number)[]
  ): ExpressionValidationError[] => {
    const propName = staticPropertyName(node.val);
    if (!propName) {
      return [];
    }

    const lookupPath = [...path, 'lookupVal'];
    return [
      ...(DANGEROUS_PROPERTIES.has(propName)
        ? [
            unsafeProperty({
              message: `Access to dangerous property '${propName}' is not allowed`,
              node,
              path: lookupPath,
            }),
          ]
        : []),
      ...(blocked.some((pattern) => pattern.test(propName))
        ? [
            unsafeProperty({
              message: `Property '${propName}' matches blocked pattern`,
              node,
              path: lookupPath,
            }),
          ]
        : []),
    ];
  };

  const checkSymbol = (
    node: SymbolNode,
    path: readonly (string | number)[]
  ): ExpressionValidationError[] => {
    const name = node.value;
    if (!DANGEROUS_PROPERTIES.has(name)) {
      return [];
    }
    return [
      unsafeProperty({
        message: `Dangerous symbol '${name}' is not allowed`,
        node,
        path: [...path, 'symbol'],
      }),
    ];
  };

  const checkCall = (
    node: CallNode,
    path: readonly (string | number)[]
  ): ExpressionValidationError[] => {
    const name = node.name;
    if (!isSymbol(name)) {
      return [];
    }
    const fnName = name.value;
    if (!DANGEROUS_CALLEES.has(fnName)) {
      return [];
    }
    return [
      unsafeProperty({
        message: `Dangerous function call '${fnName}' is not allowed`,
        node,
        path: [...path, node.type],
      }),
    ];
  };

  const walkChildNodes = (
    node: Node,
    path: readonly (string | number)[]
  ): ExpressionValidationError[] =>
    flatMap(
      Object.entries(node).filter(([key]) => !NON_CHILD_KEYS.has(key)),
      ([key, child]) => {
        if (Array.isArray(child)) {
          return flatMap(child, (element, i) => {
            if (isNode(element)) {
              return walk(element, [...path, key, i]);
            }
            // WHY: descend through quasi/slot envelopes so template literals and slot bodies
            // are security-checked like any other expression position.
            const wrapped = getEnvelopeNode(element);
            return wrapped ? walk(wrapped, [...path, key, i]) : [];
          });
        }
        if (isNode(child)) {
          return walk(child, [...path, key]);
        }
        return [];
      }
    );

  const walk = (
    node: Node | null | undefined,
    path: readonly (string | number)[]
  ): ExpressionValidationError[] => {
    if (!node) {
      return [];
    }

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

/**
 * Validates a compiled expression AST, rejecting statically-named access to
 * dangerous properties (`__proto__`, `constructor`), calls to dangerous
 * callees, and properties matching `blockedPropertyPatterns` (defaults to
 * `DEFAULT_SECURITY_CONFIG` when unset). Only statically-known names are
 * checked — dynamic lookups fall through to the runtime sandbox.
 */
export const validateExpression = (
  ast: Node,
  config: ExpressionSecurityConfig = {}
): ExpressionValidationResult => {
  const blocked = config.blockedPropertyPatterns ?? DEFAULT_SECURITY_CONFIG.blockedPropertyPatterns;
  const walk = createExpressionWalker(blocked);
  const errors = walk(ast, []);
  if (!isNonEmpty(errors)) {
    return ok(undefined);
  }
  const [first, ...rest] = errors;
  return err([first, ...rest] as const);
};
