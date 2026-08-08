import { forEach, map, pipe, reduce } from 'remeda';
import type { CallExtensionNode, ChildrenNode, Node } from './types/index.ts';
import { isNode, isCallExtension, isCallExtensionAsync } from './types/guards.ts';

const getFields = (node: Node): string[] => {
  const excluded = new Set(['type', 'lineno', 'colno', 'fields']);
  return (node.fields ?? []).filter(field => !excluded.has(field));
};

const getNodeField = (node: Node, field: string): unknown => Reflect.get(node, field);

const getNodeTypeName = (node: unknown): string | undefined => {
  if (isNode(node)) {
    return node.type;
  }
};

const appendChild = <K extends ChildrenNode>(node: K, child: Node): K =>
  ({ ...node, children: [...node.children, child] });

const mapCOW = <T>(items: readonly T[], transform: (item: T) => T): T[] => {
  const mapped = pipe(items, map(transform));
  return mapped.every((item, i) => item === items[i]) ? (items as T[]) : mapped;
};

function walkValue(value: Node, walker: (node: Node) => Node): Node;
function walkValue(value: unknown, walker: (node: Node) => Node): unknown;
function walkValue(value: unknown, walker: (node: Node) => Node): unknown {
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

const isCallExtNode = (node: Node): node is CallExtensionNode => isCallExtension(node) || isCallExtensionAsync(node);

const getTraversalFields = (node: Node): string[] =>
  getFields(node).filter(field =>
    field !== 'children' &&
    (!isCallExtNode(node) || (field !== 'args' && field !== 'contentArgs')),
  );

const walkChildren = (node: Node, walker: (node: Node) => Node): Node => {
  const { children } = node;
  if (Array.isArray(children)) {
    const newChildren = mapCOW(children, child => walker(child));
    if (newChildren !== children) {
      return { ...node, children: newChildren };
    }
    return node;
  }
  if (isCallExtNode(node)) {
    const { args } = node;
    const newArgs = walkValue(args, walker);
    const { contentArgs } = node;
    const newContentArgs = contentArgs ? mapCOW(contentArgs, child => walker(child)) : contentArgs;
    if (newArgs !== args || newContentArgs !== contentArgs) {
      return { ...node, args: newArgs, contentArgs: newContentArgs };
    }
    return node;
  }
  const fieldsList = getFields(node);
  const props = fieldsList.map(field => getNodeField(node, field));
  const newProps = mapCOW<unknown>(props, prop => walkValue(prop, walker));
  if (newProps !== props) {
    const newNode = pipe(
      fieldsList,
      reduce(
        (acc, field, i) => ({ ...acc, [field]: newProps[i] }),
        { ...node },
      ),
    );
    return newNode;
  }
  return node;
};

const walk = (ast: Node, visitor: (node: Node) => Node | undefined): Node => {
  if (!ast || typeof ast !== 'object') { return ast; }
  if (!(isNode(ast) || isCallExtNode(ast))) { return ast; }

  const replaced = visitor(ast);
  if (replaced && replaced !== ast) {
    return replaced;
  }
  const afterVisitor = replaced ?? ast;
  return walkChildren(afterVisitor, child => walk(child, visitor));
};

const matchPredicate = (node: Node, predicate: string | ((node: Node) => boolean)): boolean =>
  typeof predicate === 'string' ? node.type === predicate : predicate(node);

interface SearchFieldsOptions {
  field: string;
  onMatch: (node: Node | null | undefined) => void;
}

const searchFieldValue = (node: Node, { field, onMatch }: SearchFieldsOptions): void => {
  const value = getNodeField(node, field);
  if (Array.isArray(value)) {
    forEach(value, (item) => { if (isNode(item)) { onMatch(item); } });
  } else if (isNode(value)) {
    onMatch(value);
  }
};

const searchChildren = (node: Node, search: (node: Node | null | undefined) => void): void => {
  if (Array.isArray(node.children)) {
    forEach(node.children, (child) => { search(child); });
  }
  if (isCallExtNode(node)) {
    search(node.args);
    forEach(node.contentArgs, (argument) => { search(argument); });
  }
  forEach(getTraversalFields(node), (field) => {
    searchFieldValue(node, { field, onMatch: search });
  });
};

const findAll = (node: Node, predicate: string | ((node: Node) => boolean)): Node[] => {
  const results: Node[] = [];
  const seen = new Set<Node>();

  const search = (current: Node | null | undefined): void => {
    if (!current || seen.has(current)) { return; }
    seen.add(current);

    if (matchPredicate(current, predicate)) {
      results.push(current);
    }
    searchChildren(current, search);
  };

  search(node);
  return results;
};

export { getNodeTypeName, appendChild, walk, findAll };
