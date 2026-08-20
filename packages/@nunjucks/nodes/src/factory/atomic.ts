import type { Loc } from '@nunjucks/shared';
import type { Node, NodeOf, NodeType } from '../types/index.ts';
import { createNode, T } from './create-node.ts';
import type { BinaryFields } from './operations.ts';

const createNodeWithChildren = <K extends NodeType>(
  nodeType: K,
  loc: Loc,
  children: readonly Node[] = []
): NodeOf<K> => createNode(nodeType, loc, { children: [...children] });

// WHY: nodes own their children — copy() detaches a caller-supplied array so mutation of
// the caller's array after construction cannot mutate the node (createNodeWithChildren's
// ownership rule, factored for the optional child-array fields in control.ts).
const copy = <E>(items: readonly E[] | undefined): E[] => [...(items ?? [])];

/** Creates a `nodeList` grouping node without rendering semantics of its own. */
const nodeList = (loc: Loc, children: readonly Node[] = []) =>
  createNodeWithChildren(T.NODE_LIST, loc, children);
/** Creates an `output` node whose children each emit one interpolated value. */
const output = (loc: Loc, children: readonly Node[] = []) =>
  createNodeWithChildren(T.OUTPUT, loc, children);
/** Creates the `root` node that anchors a fully parsed template. */
const root = (loc: Loc, children: readonly Node[] = []) =>
  createNodeWithChildren(T.ROOT, loc, children);

/** Creates a `literal` node carrying a constant runtime value. */
const literal = (loc: Loc, val: unknown) => createNode(T.LITERAL, loc, { value: val });
/** Creates a `symbol` node referencing a named variable in scope. */
const symbol = (loc: Loc, val: string) => createNode(T.SYMBOL, loc, { value: val });
/** Creates a `templateData` node holding static template text. */
const templateData = (loc: Loc, val: string) => createNode(T.TEMPLATE_DATA, loc, { value: val });

/** Creates a `hole` node marking an omitted element in array or object patterns. */
const hole = (loc: Loc) => createNode(T.HOLE, loc);

/** Creates a `group` node for parenthesized sub-expressions. */
const group = (loc: Loc, children: readonly Node[] = []) =>
  createNodeWithChildren(T.GROUP, loc, children);
/** Creates an `array` literal node from element expressions. */
const array = (loc: Loc, children: readonly Node[] = []) =>
  createNodeWithChildren(T.ARRAY, loc, children);
/** Creates a `dict` literal node whose children are `pair` nodes. */
const dict = (loc: Loc, children: readonly Node[] = []) =>
  createNodeWithChildren(T.DICT, loc, children);

/** Fields for a `pair` node; `key` may be a plain string or an expression node. */
interface PairFields {
  key: Node | string;
  val: Node;
}

/** Creates a `pair` node binding a key to a value inside a `dict` literal. */
const pair = (loc: Loc, fields: PairFields) =>
  createNode(T.PAIR, loc, { key: fields.key, value: fields.val });

/** Fields for a `spread` node. */
interface SpreadFields {
  argument: Node;
}

/** Creates a `spread` node expanding an iterable into a call, array, or dict. */
const spread = (loc: Loc, fields: SpreadFields) => createNode(T.SPREAD, loc, { ...fields });

/** Fields for a `walrus` node. */
interface WalrusFields {
  target: Node;
  val: Node;
}

/** Creates a `walrus` node assigning a value inline while yielding it as an expression. */
const walrus = (loc: Loc, fields: WalrusFields) =>
  createNode(T.WALRUS, loc, { target: fields.target, value: fields.val });

/**
 * Creates a `templateLiteral` node from alternating static and interpolated segments;
 * each expression quasi must stay wrapped in its `{type:'expression', node}` envelope
 * so traversal and transforms can find the inner node.
 */
const templateLiteral = (
  loc: Loc,
  quasis: ({ type: 'template'; value: string } | { type: 'expression'; node: Node })[] = []
  // WHY: quasis is copied — the node owns its children; a caller mutating its input
  // array post-construction must not mutate the node.
) => createNode(T.TEMPLATE_LITERAL, loc, { quasis: [...quasis] });

/** Creates a `keywordArgs` node whose children are `pair` nodes of keyword arguments. */
const keywordArgs = (loc: Loc, children: readonly Node[] = []) =>
  createNodeWithChildren(T.KEYWORD_ARGS, loc, children);

/** Creates a `range` node from inclusive `left` and exclusive `right` bounds. */
const range = (loc: Loc, fields: BinaryFields) => createNode(T.RANGE, loc, { ...fields });

export type { PairFields, SpreadFields, WalrusFields };
export {
  array,
  copy,
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
