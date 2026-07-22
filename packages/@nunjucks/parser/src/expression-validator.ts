import { getNodeTypeName } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';

export const ExpressionSecurityError = {
  DYNAMIC_PROPERTY_ACCESS: 'DYNAMIC_PROPERTY_ACCESS',
  DANGEROUS_BRACKET_ACCESS: 'DANGEROUS_BRACKET_ACCESS',
  UNSAFE_PROPERTY: 'UNSAFE_PROPERTY',
};

export const DEFAULT_SECURITY_CONFIG = {
  allowDynamicPropertyAccess: false,
  allowConstructorAccess: false,
  allowPrototypeAccess: false,
  blockedPropertyPatterns: [
    /^__/,
    /constructor$/,
    /prototype$/,
  ],
};

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

export function validateExpression(ast: Node, config: Record<string, unknown> = {}): ValidationError[] {
  const cfg = { ...DEFAULT_SECURITY_CONFIG, ...config };
  const errors: ValidationError[] = [];

  function walk(node: Node | null | undefined, path: (string | number)[] = []): void {
    if (!node) return;

    const nodeType = getNodeTypeName(node);

    switch (nodeType) {
      case 'lookupVal': {
        const target = node.target as Node;
        const val = node.val as Node;

        if (val) {
          let propName: string | null = null;
          const valType = getNodeTypeName(val);

          if (valType === 'symbol') {
            propName = val.value as string;
          } else if (valType === 'literal' && typeof val.value === 'string') {
            propName = val.value;
          }

          if (propName) {
            if (DANGEROUS_PROPERTIES.has(propName)) {
              errors.push({
                code: ExpressionSecurityError.UNSAFE_PROPERTY,
                message: `Access to dangerous property '${propName}' is not allowed`,
                path: [...path, 'lookupVal'],
                lineno: node.lineno,
                colno: node.colno,
              });
            }

            if ((cfg.blockedPropertyPatterns as RegExp[]).some(pattern => pattern.test(propName))) {
              errors.push({
                code: ExpressionSecurityError.UNSAFE_PROPERTY,
                message: `Property '${propName}' matches blocked pattern`,
                path: [...path, 'lookupVal'],
                lineno: node.lineno,
                colno: node.colno,
              });
            }
          }
        }

        walk(target, [...path, 'target']);
        walk(val, [...path, 'val']);
        break;
      }

      case 'symbol': {
        if (DANGEROUS_PROPERTIES.has(node.value as string)) {
          errors.push({
            code: ExpressionSecurityError.UNSAFE_PROPERTY,
            message: `Dangerous symbol '${node.value as string}' is not allowed`,
            path: [...path, 'symbol'],
            lineno: node.lineno,
            colno: node.colno,
          });
        }
        break;
      }

      case 'funCall':
      case 'pipe': {
        const name = node.name as Node;
        if (name && getNodeTypeName(name) === 'symbol') {
          const fnName = name.value as string;
          if (fnName === 'eval' || fnName === 'Function' || fnName === 'execScript') {
            errors.push({
              code: ExpressionSecurityError.UNSAFE_PROPERTY,
              message: `Dangerous function call '${fnName}' is not allowed`,
              path: [...path, nodeType ?? ''],
              lineno: node.lineno,
              colno: node.colno,
            });
          }
        }
        walk(name, [...path, 'name']);
        walk(node.args as Node, [...path, 'args']);
        break;
      }

      default: {
        for (const key of Object.keys(node)) {
          if (key === 'lineno' || key === 'colno' || key === 'fields') continue;
          const child = (node as Record<string, unknown>)[key];
          if (Array.isArray(child)) {
            child.forEach((c, i) => walk(c as Node, [...path, key, i]));
          } else if (child && typeof child === 'object') {
            walk(child as Node, [...path, key]);
          }
        }
      }
    }
  }

  walk(ast);
  return errors;
}

export function isExpressionSafe(ast: Node, config: Record<string, unknown> = {}): boolean {
  const errors = validateExpression(ast, config);
  return errors.length === 0;
}
