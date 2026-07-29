// TRAVERSE - Canonical AST walk / search / transform utilities (copy-on-write).
import { filter, forEach, map, reduce } from 'remeda';
import type { CallExtensionNode, ChildrenNode, Node } from './types/index.ts';
import { isNode, isCallExtension, isCallExtensionAsync } from './types/guards.ts';

const getFields = (n: Node): string[] => {
  const excluded = new Set(['type', 'lineno', 'colno', 'fields']);
  return (n.fields ?? []).filter(f => !excluded.has(f));
};

const getType = (n: unknown): string | undefined => {
  if (isNode(n)) {
    return n.type;
  }
};
const getFields_ = (n: Node): readonly string[] => getFields(n);

const getNodeTypeName = getType;
const getNodeFields = getFields_;

const appendChild = <K extends ChildrenNode>(node: K, child: Node): K =>
  ({ ...node, children: [...node.children, child] });

const mapCOW = <T>(arr: readonly T[], fn: (item: T) => T): T[] => {
  const mapped = map(arr, fn);
  return mapped.every((item, i) => item === arr[i]) ? (arr as T[]) : mapped;
};

const walkValue = (val: unknown, walker: (n: Node) => Node): unknown => {
  if (Array.isArray(val)) {
    return mapCOW(val, item => {
      if (isNode(item)) {
        return walker(item);
      }
      return item;
    });
  }
  if (isNode(val)) {
    return walker(val);
  }
  return val;
};

const isCallExtNode = (n: Node): n is CallExtensionNode => isCallExtension(n) || isCallExtensionAsync(n);

const getTraversalFields = (node: Node): string[] =>
  getFields(node).filter(field =>
    field !== 'children' &&
    (!isCallExtNode(node) || (field !== 'args' && field !== 'contentArgs')),
  );

const walkChildren = (node: Node, walker: (n: Node) => Node): Node => {
  const { children } = node;
  if (Array.isArray(children)) {
    const newChildren = mapCOW(children, c => walker(c));
    if (newChildren !== children) {
      return { ...node, children: newChildren } as Node;
    }
    return node;
  }
  if (isCallExtNode(node)) {
    const { args } = node;
    const newArgs = walkValue(args, walker);
    const { contentArgs } = node;
    const newContentArgs = contentArgs ? mapCOW(contentArgs, c => walker(c)) : contentArgs;
    if (newArgs !== args || newContentArgs !== contentArgs) {
      return { ...node, args: newArgs, contentArgs: newContentArgs } as Node;
    }
    return node;
  }
  const fieldsList = getFields(node);
  const props = fieldsList.map(f => node[f]);
  const newProps = mapCOW<unknown>(props, p => walkValue(p, walker));
  if (newProps !== props) {
    const newNode = reduce(
      fieldsList,
      (acc, f, i) => { acc[f] = newProps[i]; return acc; },
      { ...node } as Record<string, unknown>,
    );
    return newNode as Node;
  }
  return node;
};

const walk = (ast: Node, fn: (n: Node) => Node | undefined): Node => {
  if (!ast || typeof ast !== 'object') { return ast as Node; }
  if (!(isNode(ast) || isCallExtNode(ast))) { return ast; }

  const replaced = fn(ast);
  if (replaced && replaced !== ast) {
    return replaced as Node;
  }
  const afterFn = (replaced ?? ast) as Node;
  return walkChildren(afterFn, c => walk(c, fn));
};

const depthWalk = (ast: Node, fn: (n: Node) => Node | undefined): Node => {
  if (!ast || typeof ast !== 'object') { return ast as Node; }
  if (!(isNode(ast) || isCallExtNode(ast))) { return ast; }

  const walked = walkChildren(ast, c => depthWalk(c, fn));
  const replaced = fn(walked);
  return (replaced ?? walked) as Node;
};

const matchPredicate = (n: Node, predicate: string | ((n: Node) => boolean)): boolean =>
  typeof predicate === 'string' ? n.type === predicate : predicate(n);

const searchFieldValue = (n: Node, field: string, search: (n: Node | null | undefined) => void): void => {
  const val = n[field];
  if (Array.isArray(val)) {
    forEach(val, item => { if (isNode(item)) { search(item); } });
  } else if (isNode(val)) {
    search(val);
  }
};

const searchChildren = (n: Node, search: (n: Node | null | undefined) => void): void => {
  if (Array.isArray(n.children)) {
    n.children.forEach(search);
  }
  if (isCallExtNode(n)) {
    search(n.args);
    n.contentArgs.forEach(search);
  }
  forEach(getTraversalFields(n), field => {
    searchFieldValue(n, field, search);
  });
};

const findAll = (node: Node, predicate: string | ((n: Node) => boolean)): Node[] => {
  const results: Node[] = [];
  const seen = new Set<Node>();

  const search = (n: Node | null | undefined): void => {
    if (!n || seen.has(n)) { return; }
    seen.add(n);

    if (matchPredicate(n, predicate)) {
      results.push(n);
    }
    searchChildren(n, search);
  };

  search(node);
  return results;
};

/**
 * First node in pre-order that satisfies `predicate`.
 *
 * This used to carry its own copy of the traversal (children, then call
 * extension args, then the remaining fields). `iterateNodes` already walks in
 * exactly that order and stops as soon as the consumer does, so the search is
 * just a loop over it.
 */
const findFirst = (node: Node, predicate: (n: Node) => boolean): Node | undefined => {
  for (const n of iterateNodes(node)) {
    if (predicate(n)) { return n; }
  }
};

const count = (node: Node, predicate?: (n: Node) => boolean): number => {
  const all = findAll(node, () => true);
  return predicate ? filter(all, predicate).length : all.length;
};

const yieldFromField = function* (node: Node, field: string): Generator<Node> {
  const val = node[field];
  if (Array.isArray(val)) {
    for (const item of val) { if (isNode(item)) { yield* iterateNodes(item); } }
  } else if (isNode(val)) {
    yield* iterateNodes(val);
  }
};

const yieldNodeChildren = function* (node: Node): Generator<Node> {
  if (isCallExtNode(node)) {
    yield* iterateNodes(node.args);
    for (const child of node.contentArgs) { yield* iterateNodes(child); }
  }
  for (const field of getTraversalFields(node)) {
    yield* yieldFromField(node, field);
  }
};

const iterateNodeChildren = function* (node: Node): Generator<Node> {
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      yield* iterateNodes(child);
    }
  }
  yield* yieldNodeChildren(node);
};

export function* iterateNodes(node: Node): Generator<Node> {
  yield node;
  yield* iterateNodeChildren(node);
}

export function* filterNodes(ast: Node, predicate: (n: Node) => boolean): Generator<Node> {
  for (const n of iterateNodes(ast)) {
    if (predicate(n)) { yield n; }
  }
}

export { getType, getFields_, getNodeTypeName, getNodeFields, appendChild, mapCOW, walk, depthWalk, findAll, findFirst, count };
