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
  caller,
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
  is,
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
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { forEach } from 'remeda';
import type { Compiler, NodeTypeMatcher } from './index.ts';

const EXPRESSION_TYPES: NodeTypeMatcher[] = [
  literal, symbol, group, array, dict, funCall, caller, pipeNode, lookupVal,
  compare, inlineIf, 'in', is, and, or, not, add, concat, sub, mul, div,
  floorDiv, mod, pow, neg, pos, optionalChain, nullishCoalesce, nodeList,
  slice, bitwiseOr, bitwiseAnd, bitwiseXor, bitwiseLShift, bitwiseRShift,
  bitwiseNot, increment, decrement,
];

export const compileChildren = (
  ctx: Pick<Compiler, 'compile'>,
  node: Node,
  frame?: Frame
): void => {
  forEach(node.children ?? [], child => ctx.compile(child, frame));
};

export const compileExpression = (
  ctx: Pick<Compiler, 'assertType' | 'compile'>,
  node: Node,
  frame?: Frame
): void => {
  ctx.assertType(node, ...EXPRESSION_TYPES);
  ctx.compile(node, frame);
};

export const assertType = (
  node: Node,
  ...types: NodeTypeMatcher[]
): void => {
  const typeName = getNodeTypeName(node);
  const matches = types.some(type => {
    if (typeof type === 'string') {
      return typeName === type;
    }
    if (type?.name && typeName === type.name) {
      return true;
    }
    return Boolean(type?.name && typeName === type.name.toLowerCase());
  });

  if (!matches) {
    const error = new Error(
      `assertType: invalid type: ${typeName}`
    ) as Error & Record<string, unknown>;
    error.code = 'ASSERT_TYPE_ERROR';
    error.subject = typeName;
    error.lineno = node.lineno ?? null;
    error.colno = node.colno ?? null;
    error.lineBase = 'zero';
    throw error;
  }
};
