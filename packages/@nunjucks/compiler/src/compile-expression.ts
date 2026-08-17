import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import { createLog } from '@nunjucks/error-formatter';
import type { Node } from '@nunjucks/nodes';
import {
  add,
  and,
  array,
  bitwiseAnd,
  bitwiseLShift,
  bitwiseNot,
  bitwiseOr,
  bitwiseRShift,
  bitwiseXor,
  compare,
  concat,
  decrement,
  dict,
  div,
  floorDiv,
  funCall,
  getNodeTypeName,
  group,
  increment,
  inlineIf,
  literal,
  lookupVal,
  mod,
  mul,
  neg,
  nodeList,
  not,
  nullishCoalesce,
  optionalChain,
  or,
  pipe as pipeNode,
  pos,
  pow,
  slice,
  sub,
  symbol,
} from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler, NodeTypeMatcher } from './index.ts';

const EXPRESSION_TYPES: NodeTypeMatcher[] = [
  literal,
  symbol,
  group,
  array,
  dict,
  funCall,
  pipeNode,
  lookupVal,
  compare,
  inlineIf,
  'in',
  'is',
  and,
  or,
  not,
  add,
  concat,
  'range',
  sub,
  mul,
  div,
  floorDiv,
  mod,
  pow,
  neg,
  pos,
  optionalChain,
  // WHY: templateLiteral / optionalCall / walrus are parser-producible at guarded
  // expression positions (`{% if `a${b}` %}`, `obj?.()[0]`, `{% set y = (x := 5) %}`)
  // — omitting them made assertType throw ASSERT_TYPE_ERROR on legal templates.
  'templateLiteral',
  'optionalCall',
  'walrus',
  nullishCoalesce,
  nodeList,
  slice,
  bitwiseOr,
  bitwiseAnd,
  bitwiseXor,
  bitwiseLShift,
  bitwiseRShift,
  bitwiseNot,
  increment,
  decrement,
  'test',
  'testCall',
];

export const compileNodeChildren = (
  compiler: Pick<Compiler, 'compile'>,
  node: Node,
  frame: Frame
): void => {
  forEach(node.children ?? [], (child) => compiler.compile(child, frame));
};

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
  return typeName === type.name || typeName === type.name.toLowerCase();
};

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
