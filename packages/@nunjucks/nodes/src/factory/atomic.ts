import { T, createNode } from './internal.ts';
import type { Node, NodeOf, NodeType } from '../types/index.ts';

const createNodeWithChildren = <K extends NodeType>(nodeType: K, lineno: number, colno: number, children: readonly Node[] = []): NodeOf<K> =>
  createNode(nodeType, lineno, colno, { children: [...children] });

const node = (lineno: number, colno: number) => createNode(T.NODE, lineno, colno);
const value = (lineno: number, colno: number, val: unknown) => createNode(T.VALUE, lineno, colno, { value: val });
const nodeList = (lineno: number, colno: number, children: readonly Node[] = []) => createNodeWithChildren(T.NODE_LIST, lineno, colno, children);
const output = (lineno: number, colno: number, children: readonly Node[] = []) => createNodeWithChildren(T.OUTPUT, lineno, colno, children);
const root = (lineno: number, colno: number, children: readonly Node[] = []) => createNodeWithChildren(T.ROOT, lineno, colno, children);

const literal = (lineno: number, colno: number, val: unknown) => createNode(T.LITERAL, lineno, colno, { value: val });
const symbol = (lineno: number, colno: number, val: string) => createNode(T.SYMBOL, lineno, colno, { value: val });
const templateData = (lineno: number, colno: number, val: string) => createNode(T.TEMPLATE_DATA, lineno, colno, { value: val });

const hole = (lineno: number, colno: number) => createNode(T.HOLE, lineno, colno);

const group = (lineno: number, colno: number, children: readonly Node[] = []) => createNodeWithChildren(T.GROUP, lineno, colno, children);
const array = (lineno: number, colno: number, children: readonly Node[] = []) => createNodeWithChildren(T.ARRAY, lineno, colno, children);
const dict = (lineno: number, colno: number, children: readonly Node[] = []) => createNodeWithChildren(T.DICT, lineno, colno, children);
const pair = (lineno: number, colno: number, key: Node | string, val: Node) => createNode(T.PAIR, lineno, colno, { key, value: val });
const spread = (lineno: number, colno: number, argument: Node) => createNode(T.SPREAD, lineno, colno, { argument });
const walrus = (lineno: number, colno: number, target: Node, val: Node) => createNode(T.WALRUS, lineno, colno, { target, value: val });

const templateLiteral = (lineno: number, colno: number, quasis: ({ type: 'template'; value: string } | { type: 'expression'; node: Node })[] = []) => createNode(T.TEMPLATE_LITERAL, lineno, colno, { quasis });

const keywordArgs = (lineno: number, colno: number, children: readonly Node[] = []) => createNodeWithChildren(T.KEYWORD_ARGS, lineno, colno, children);

const range = (lineno: number, colno: number, left: Node, right: Node) => createNode(T.RANGE, lineno, colno, { left, right });

export {
  node, value, nodeList, output, root,
  literal, symbol, templateData,
  hole,
  group, array, dict, pair, spread, walrus,
  templateLiteral, keywordArgs,
  range,
};
