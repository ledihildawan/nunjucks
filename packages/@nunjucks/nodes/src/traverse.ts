import { map, pipe, reduce } from 'remeda';
import type { CallExtensionNode, ChildrenNode, Node } from './types/index.ts';
import { isNode, isCallExtension, isCallExtensionAsync } from './types/guards.ts';

const getFields = (n: Node): string[] => {
  const excluded = new Set(['type', 'lineno', 'colno', 'fields']);
  return (n.fields ?? []).filter(f => !excluded.has(f));
};

const getNodeField = (node: Node, field: string): unknown => Reflect.get(node, field);

const getNodeTypeName = (n: unknown): string | undefined => {
  if (isNode(n)) {
    return n.type;
  }
};

const appendChild = <K extends ChildrenNode>(node: K, child: Node): K =>
  ({ ...node, children: [...node.children, child] });

const mapCOW = <T>(arr: readonly T[], fn: (item: T) => T): T[] => {
  const mapped = pipe(arr, map(fn));
  return mapped.every((item, i) => item === arr[i]) ? (arr as T[]) : mapped;
};

function walkValue(value: Node, walker: (n: Node) => Node): Node;
function walkValue(value: unknown, walker: (n: Node) => Node): unknown;
function walkValue(value: unknown, walker: (n: Node) => Node): unknown {
  if (Array.isArray(value)) {
    return mapCOW(value, item => {
      if (isNode(item)) {
        return walker(item);
      }
      return item;
    });
  }
  if (isNode(value)) {
    return walker(value);
  }
  return value;
}

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
      return { ...node, children: newChildren };
    }
    return node;
  }
  if (isCallExtNode(node)) {
    const { args } = node;
    const newArgs = walkValue(args, walker);
    const { contentArgs } = node;
    const newContentArgs = contentArgs ? mapCOW(contentArgs, c => walker(c)) : contentArgs;
    if (newArgs !== args || newContentArgs !== contentArgs) {
      return { ...node, args: newArgs, contentArgs: newContentArgs };
    }
    return node;
  }
  const fieldsList = getFields(node);
  const props = fieldsList.map(f => getNodeField(node, f));
  const newProps = mapCOW<unknown>(props, p => walkValue(p, walker));
  if (newProps !== props) {
    const newNode = pipe(
      fieldsList,
      reduce(
        (acc, f, i) => ({ ...acc, [f]: newProps[i] }),
        { ...node },
      ),
    );
    return newNode;
  }
  return node;
};

const walk = (ast: Node, fn: (n: Node) => Node | undefined): Node => {
  if (!ast || typeof ast !== 'object') { return ast; }
  if (!(isNode(ast) || isCallExtNode(ast))) { return ast; }

  const replaced = fn(ast);
  if (replaced && replaced !== ast) {
    return replaced;
  }
  const afterFn = replaced ?? ast;
  return walkChildren(afterFn, c => walk(c, fn));
};

const matchPredicate = (n: Node, predicate: string | ((n: Node) => boolean)): boolean =>
  typeof predicate === 'string' ? n.type === predicate : predicate(n);

const searchFieldValue = (n: Node, field: string, search: (n: Node | null | undefined) => void): void => {
  const value = getNodeField(n, field);
  if (Array.isArray(value)) {
    for (const item of value) { if (isNode(item)) { search(item); } }
  } else if (isNode(value)) {
    search(value);
  }
};

const searchChildren = (n: Node, search: (n: Node | null | undefined) => void): void => {
  if (Array.isArray(n.children)) {
    for (const child of n.children) { search(child); }
  }
  if (isCallExtNode(n)) {
    search(n.args);
    for (const argument of n.contentArgs) { search(argument); }
  }
  for (const field of getTraversalFields(n)) {
    searchFieldValue(n, field, search);
  }
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

export { getNodeTypeName, appendChild, walk, findAll };
