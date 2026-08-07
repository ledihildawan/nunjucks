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
import type { Node } from '@nunjucks/nodes';
import type { Frame } from '@nunjucks/runtime';
import { createLog } from '@nunjucks/log';
import { forEach } from 'remeda';
import type { Compiler, NodeTypeMatcher } from './index.ts';

const EXPRESSION_TYPES: NodeTypeMatcher[] = [
  literal, symbol, group, array, dict, funCall, pipeNode, lookupVal,
  compare, inlineIf, 'in', 'is', and, or, not, add, concat, 'range', sub, mul, div,
  floorDiv, mod, pow, neg, pos, optionalChain, nullishCoalesce, nodeList,
  slice, bitwiseOr, bitwiseAnd, bitwiseXor, bitwiseLShift, bitwiseRShift,
  bitwiseNot, increment, decrement, 'test', 'testCall',
];

export const compileChildren = (
  compiler: Pick<Compiler, 'compile'>,
  node: Node,
  frame: Frame
): void => {
  forEach(node.children ?? [], child => compiler.compile(child, frame));
};

export const compileExpression = (
  compiler: Pick<Compiler, 'assertType' | 'compile'>,
  node: Node,
  frame: Frame
): void => {
  compiler.assertType(node, ...EXPRESSION_TYPES);
  compiler.compile(node, frame);
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
    throw createLog(
      'error',
      { name: 'ASSERT_TYPE_ERROR', message: `assertType: invalid type: ${typeName}` },
      undefined,
      typeName,
      { phase: 'compile', lineno: node.lineno ?? null, colno: node.colno ?? null, lineBase: 'zero' },
    );
  }
};
