import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { createLog } from '@nunjucks/error-formatter';
import type { Node } from '@nunjucks/nodes';
import { getNodeTypeName, T } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler, NodeTypeMatcher } from './index.ts';

// WHY: string `T.*` tags only — factory functions matched via runtime `.name` would
// silently break under minification (renamed functions stop matching their node type).
const EXPRESSION_TYPES: NodeTypeMatcher[] = [
  T.LITERAL,
  T.SYMBOL,
  T.GROUP,
  T.ARRAY,
  T.DICT,
  T.FUN_CALL,
  T.PIPE,
  T.LOOKUP_VAL,
  T.COMPARE,
  T.INLINE_IF,
  T.IN,
  T.IS,
  T.AND,
  T.OR,
  T.NOT,
  T.ADD,
  T.CONCAT,
  T.RANGE,
  T.SUB,
  T.MUL,
  T.DIV,
  T.FLOOR_DIV,
  T.MOD,
  T.POW,
  T.NEG,
  T.POS,
  T.OPTIONAL_CHAIN,
  // WHY: templateLiteral / optionalCall / walrus are parser-producible at guarded
  // expression positions (`{% if `a${b}` %}`, `obj?.()[0]`, `{% set y = (x := 5) %}`)
  // — omitting them made assertType throw ASSERT_TYPE_ERROR on legal templates.
  T.TEMPLATE_LITERAL,
  T.OPTIONAL_CALL,
  T.WALRUS,
  T.NULLISH_COALESCE,
  T.NODE_LIST,
  T.SLICE,
  T.BITWISE_OR,
  T.BITWISE_AND,
  T.BITWISE_XOR,
  T.BITWISE_LSHIFT,
  T.BITWISE_RSHIFT,
  T.BITWISE_NOT,
  T.INCREMENT,
  T.DECREMENT,
  T.TEST,
  T.TEST_CALL,
];

/** Compiles every child of `node` in order against `frame`. */
export const compileNodeChildren = (
  compiler: Pick<Compiler, 'compile'>,
  node: Node,
  frame: Frame
): void => {
  forEach(node.children ?? [], (child) => compiler.compile(child, frame));
};

/**
 * Asserts `node` is one of `EXPRESSION_TYPES`, then compiles it — statement
 * nodes reaching an expression slot throw `ASSERT_TYPE_ERROR` instead of
 * emitting unbalanced fragments.
 */
export const compileNodeExpression = (
  compiler: Pick<Compiler, 'assertType' | 'compile'>,
  node: Node,
  frame: Frame
): void => {
  compiler.assertType(node, ...EXPRESSION_TYPES);
  compiler.compile(node, frame);
};

const isMatchingType = (typeName: string | undefined, type: NodeTypeMatcher): boolean => {
  if (typeof type === 'string') {
    return typeName === type;
  }
  if (type.name === undefined) {
    return false;
  }
  return typeName === type.name;
};

/**
 * Throws a catalogued `ASSERT_TYPE_ERROR` unless `node` matches one of
 * `types`; a matcher is either a node-type tag string or an object whose
 * `name` equals the tag.
 */
export const assertNodeType = (node: Node, ...types: NodeTypeMatcher[]): void => {
  const typeName = getNodeTypeName(node) ?? 'unknown';
  const matches = types.some((type) => isMatchingType(typeName, type));

  if (!matches) {
    // WHY: canonical catalog definition keeps causes/fixCode enrichment — an inline
    // def would drift from the registry (ARCHITECTURE §6 error-cluster contract).
    throw createLog('error', {
      def: ERROR_DEFINITIONS.ASSERT_TYPE_ERROR,
      params: { type: typeName },
      subject: typeName,
      context: {
        phase: 'compile',
        lineno: node.lineno ?? null,
        colno: node.colno ?? null,
        lineBase: 'zero',
      },
    });
  }
};
