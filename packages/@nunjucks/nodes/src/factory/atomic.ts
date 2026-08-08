import { T, createNode } from './internal.ts';
import type { Loc } from '@nunjucks/shared';
import type { Node, NodeOf, NodeType } from '../types/index.ts';

const createNodeWithChildren = <K extends NodeType>(nodeType: K, loc: Loc, children: readonly Node[] = []): NodeOf<K> =>
  createNode(nodeType, loc, { children: [...children] });

const node = (loc: Loc) => createNode(T.NODE, loc);
const value = (loc: Loc, val: unknown) => createNode(T.VALUE, loc, { value: val });
const nodeList = (loc: Loc, children: readonly Node[] = []) => createNodeWithChildren(T.NODE_LIST, loc, children);
const output = (loc: Loc, children: readonly Node[] = []) => createNodeWithChildren(T.OUTPUT, loc, children);
const root = (loc: Loc, children: readonly Node[] = []) => createNodeWithChildren(T.ROOT, loc, children);

const literal = (loc: Loc, val: unknown) => createNode(T.LITERAL, loc, { value: val });
const symbol = (loc: Loc, val: string) => createNode(T.SYMBOL, loc, { value: val });
const templateData = (loc: Loc, val: string) => createNode(T.TEMPLATE_DATA, loc, { value: val });

const hole = (loc: Loc) => createNode(T.HOLE, loc);

const group = (loc: Loc, children: readonly Node[] = []) => createNodeWithChildren(T.GROUP, loc, children);
const array = (loc: Loc, children: readonly Node[] = []) => createNodeWithChildren(T.ARRAY, loc, children);
const dict = (loc: Loc, children: readonly Node[] = []) => createNodeWithChildren(T.DICT, loc, children);
const pair = (loc: Loc, key: Node | string, val: Node) => createNode(T.PAIR, loc, { key, value: val });
const spread = (loc: Loc, argument: Node) => createNode(T.SPREAD, loc, { argument });
const walrus = (loc: Loc, target: Node, val: Node) => createNode(T.WALRUS, loc, { target, value: val });

const templateLiteral = (loc: Loc, quasis: ({ type: 'template'; value: string } | { type: 'expression'; node: Node })[] = []) => createNode(T.TEMPLATE_LITERAL, loc, { quasis });

const keywordArgs = (loc: Loc, children: readonly Node[] = []) => createNodeWithChildren(T.KEYWORD_ARGS, loc, children);

const range = (loc: Loc, left: Node, right: Node) => createNode(T.RANGE, loc, { left, right });

export {
  node, value, nodeList, output, root,
  literal, symbol, templateData,
  hole,
  group, array, dict, pair, spread, walrus,
  templateLiteral, keywordArgs,
  range,
};
