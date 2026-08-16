import type { Loc } from '@nunjucks/shared';
import type { Node, NodeOf, NodeType } from '../types/index.ts';
import { createNode, T } from './create-node.ts';
import type { BinaryFields } from './operations.ts';

const createNodeWithChildren = <K extends NodeType>(
  nodeType: K,
  loc: Loc,
  children: readonly Node[] = []
): NodeOf<K> => createNode(nodeType, loc, { children: [...children] });

const nodeList = (loc: Loc, children: readonly Node[] = []) =>
  createNodeWithChildren(T.NODE_LIST, loc, children);
const output = (loc: Loc, children: readonly Node[] = []) =>
  createNodeWithChildren(T.OUTPUT, loc, children);
const root = (loc: Loc, children: readonly Node[] = []) =>
  createNodeWithChildren(T.ROOT, loc, children);

const literal = (loc: Loc, val: unknown) => createNode(T.LITERAL, loc, { value: val });
const symbol = (loc: Loc, val: string) => createNode(T.SYMBOL, loc, { value: val });
const templateData = (loc: Loc, val: string) => createNode(T.TEMPLATE_DATA, loc, { value: val });

const hole = (loc: Loc) => createNode(T.HOLE, loc);

const group = (loc: Loc, children: readonly Node[] = []) =>
  createNodeWithChildren(T.GROUP, loc, children);
const array = (loc: Loc, children: readonly Node[] = []) =>
  createNodeWithChildren(T.ARRAY, loc, children);
const dict = (loc: Loc, children: readonly Node[] = []) =>
  createNodeWithChildren(T.DICT, loc, children);

interface PairFields {
  key: Node | string;
  val: Node;
}

const pair = (loc: Loc, fields: PairFields) =>
  createNode(T.PAIR, loc, { key: fields.key, value: fields.val });

interface SpreadFields {
  argument: Node;
}

const spread = (loc: Loc, fields: SpreadFields) => createNode(T.SPREAD, loc, { ...fields });

interface WalrusFields {
  target: Node;
  val: Node;
}

const walrus = (loc: Loc, fields: WalrusFields) =>
  createNode(T.WALRUS, loc, { target: fields.target, value: fields.val });

const templateLiteral = (
  loc: Loc,
  quasis: ({ type: 'template'; value: string } | { type: 'expression'; node: Node })[] = []
) => createNode(T.TEMPLATE_LITERAL, loc, { quasis });

const keywordArgs = (loc: Loc, children: readonly Node[] = []) =>
  createNodeWithChildren(T.KEYWORD_ARGS, loc, children);

const range = (loc: Loc, fields: BinaryFields) => createNode(T.RANGE, loc, { ...fields });

export type { PairFields, SpreadFields, WalrusFields };
export {
  array,
  dict,
  group,
  hole,
  keywordArgs,
  literal,
  nodeList,
  output,
  pair,
  range,
  root,
  spread,
  symbol,
  templateData,
  templateLiteral,
  walrus,
};
