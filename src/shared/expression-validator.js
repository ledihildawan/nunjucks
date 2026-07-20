import { nodes } from '../nodes/index.js';

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

export function validateExpression(ast, config = {}) {
  const cfg = { ...DEFAULT_SECURITY_CONFIG, ...config };
  const errors = [];

  function walk(node, path = []) {
    if (!node) return;

    const nodeType = nodes.getNodeTypeName(node);

    switch (nodeType) {
      case 'lookupVal': {
        const target = node.target;
        const val = node.val;

        if (val) {
          let propName = null;
          const valType = nodes.getNodeTypeName(val);
          
          if (valType === 'symbol') {
            propName = val.value;
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

            if (cfg.blockedPropertyPatterns.some(pattern => pattern.test(propName))) {
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
        if (DANGEROUS_PROPERTIES.has(node.value)) {
          errors.push({
            code: ExpressionSecurityError.UNSAFE_PROPERTY,
            message: `Dangerous symbol '${node.value}' is not allowed`,
            path: [...path, 'symbol'],
            lineno: node.lineno,
            colno: node.colno,
          });
        }
        break;
      }

      case 'funCall':
      case 'pipe': {
        if (node.name && nodes.getNodeTypeName(node.name) === 'symbol') {
          const fnName = node.name.value;
          if (fnName === 'eval' || fnName === 'Function' || fnName === 'execScript') {
            errors.push({
              code: ExpressionSecurityError.UNSAFE_PROPERTY,
              message: `Dangerous function call '${fnName}' is not allowed`,
              path: [...path, nodeType],
              lineno: node.lineno,
              colno: node.colno,
            });
          }
        }
        walk(node.name, [...path, 'name']);
        walk(node.args, [...path, 'args']);
        break;
      }

      default: {
        for (const key of Object.keys(node)) {
          if (key === 'lineno' || key === 'colno' || key === 'fields') continue;
          const child = node[key];
          if (Array.isArray(child)) {
            child.forEach((c, i) => walk(c, [...path, key, i]));
          } else if (child && typeof child === 'object') {
            walk(child, [...path, key]);
          }
        }
      }
    }
  }

  walk(ast);
  return errors;
}

export function isExpressionSafe(ast, config = {}) {
  const errors = validateExpression(ast, config);
  return errors.length === 0;
}
