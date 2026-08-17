import { map, pipe, reduce } from 'remeda';
import { isCallExtension, isCallExtensionAsync, isNode } from './types/guards.ts';
import type { CallExtensionNode, ChildrenNode, Node } from './types/index.ts';

const getFields = (node: Node): string[] => {
  const excluded = new Set(['type', 'lineno', 'colno', 'fields']);
  return (node.fields ?? []).filter((field) => !excluded.has(field));
};

const getNodeField = (node: Node, field: string): unknown => Reflect.get(node, field);

/** Returns the `type` tag when the value is a `Node`, else `undefined`. */
const getNodeTypeName = (node: unknown): string | undefined => {
  if (isNode(node)) {
    return node.type;
  }
};

/** Appends a child to a node's children array without mutating the original. */
const appendChild = <K extends ChildrenNode>(node: K, child: Node): K => ({
  ...node,
  children: [...node.children, child],
});

const mapCOW = <T>(items: readonly T[], transform: (item: T) => T): T[] => {
  const mapped = pipe(items, map(transform));
  return mapped.every((item, i) => item === items[i]) ? (items as T[]) : mapped;
};

interface EnvelopeBinding {
  readonly node: Node;
  readonly key: 'node' | 'body';
}

// WHY: template-literal quasis wrap real Nodes in `{type:'expression', node}` envelopes and
// component/render slots wrap bodies in `{name, params, body}` SlotBlock envelopes — raw field
// walks must descend through both or the wrapped expressions become invisible to transforms.
const unwrapEnvelope = (item: unknown): EnvelopeBinding | undefined => {
  if (!item || typeof item !== 'object' || isNode(item)) {
    return undefined;
  }
  const record = item as Record<string, unknown>;
  if (typeof record.type === 'string' && isNode(record.node)) {
    return { node: record.node, key: 'node' };
  }
  if (typeof record.name === 'string' && isNode(record.body)) {
    return { node: record.body, key: 'body' };
  }
  return undefined;
};

/** Unwraps an expression or `SlotBlock` envelope to the `Node` it carries, else `undefined`. */
const getEnvelopeNode = (item: unknown): Node | undefined => unwrapEnvelope(item)?.node;

const walkEnvelopeItem = (item: unknown, walker: (node: Node) => Node): unknown => {
  const binding = unwrapEnvelope(item);
  if (!binding) {
    return item;
  }
  const visited = walker(binding.node);
  if (visited === binding.node) {
    return item;
  }
  return { ...(item as Record<string, unknown>), [binding.key]: visited };
};

function walkValue(value: Node, walker: (node: Node) => Node): Node;
function walkValue(value: unknown, walker: (node: Node) => Node): unknown;
function walkValue(value: unknown, walker: (node: Node) => Node): unknown {
  if (Array.isArray(value)) {
    return mapCOW(value, (item) => (isNode(item) ? walker(item) : walkEnvelopeItem(item, walker)));
  }
  if (isNode(value)) {
    return walker(value);
  }
  return value;
}

const isCallExtNode = (node: Node): node is CallExtensionNode =>
  isCallExtension(node) || isCallExtensionAsync(node);

const getTraversalFields = (node: Node): string[] =>
  getFields(node).filter(
    (field) =>
      field !== 'children' &&
      (!isCallExtNode(node) || (field !== 'args' && field !== 'contentArgs'))
  );

const walkChildren = (node: Node, walker: (node: Node) => Node): Node => {
  const { children } = node;
  if (Array.isArray(children)) {
    const newChildren = mapCOW(children, (child) => walker(child));
    if (newChildren !== children) {
      return { ...node, children: newChildren };
    }
    return node;
  }
  if (isCallExtNode(node)) {
    const { args } = node;
    const newArgs = walkValue(args, walker);
    const { contentArgs } = node;
    const newContentArgs = contentArgs
      ? mapCOW(contentArgs, (child) => walker(child))
      : contentArgs;
    if (newArgs !== args || newContentArgs !== contentArgs) {
      return { ...node, args: newArgs, contentArgs: newContentArgs };
    }
    return node;
  }
  const fieldsList = getFields(node);
  const props = fieldsList.map((field) => getNodeField(node, field));
  const newProps = mapCOW<unknown>(props, (prop) => walkValue(prop, walker));
  if (newProps !== props) {
    const newNode = pipe(
      fieldsList,
      reduce((acc, field, i) => ({ ...acc, [field]: newProps[i] }), { ...node })
    );
    return newNode;
  }
  return node;
};

/**
 * Depth-first AST walk that threads a replace-visitor through every child slot; returns
 * a new tree when the visitor returns new nodes, else the same reference. Descends into
 * template-literal quasis and `SlotBlock` envelopes, and short-circuits a subtree whose
 * visitor returned a replacement.
 */
const walk = (ast: Node, visitor: (node: Node) => Node | undefined): Node => {
  if (!ast || typeof ast !== 'object') {
    return ast;
  }
  if (!(isNode(ast) || isCallExtNode(ast))) {
    return ast;
  }

  const replaced = visitor(ast);
  if (replaced && replaced !== ast) {
    return replaced;
  }
  const afterVisitor = replaced ?? ast;
  return walkChildren(afterVisitor, (child) => walk(child, visitor));
};

const matchPredicate = (node: Node, predicate: string | ((node: Node) => boolean)): boolean =>
  typeof predicate === 'string' ? node.type === predicate : predicate(node);

const getFieldNodes = (node: Node, field: string): Node[] => {
  const value = getNodeField(node, field);
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (isNode(item)) {
        return [item];
      }
      const wrapped = getEnvelopeNode(item);
      return wrapped ? [wrapped] : [];
    });
  }
  return isNode(value) ? [value] : [];
};

/**
 * Collects the direct children of a node: the `children` array, then `args`/`contentArgs`
 * for call-extension nodes, then every node reachable through the remaining field slots
 * (descending through expression and `SlotBlock` envelopes).
 */
const getChildNodes = (node: Node): Node[] => {
  const children = Array.isArray(node.children) ? node.children.filter(isNode) : [];
  const callExtChildren = isCallExtNode(node)
    ? [node.args, ...node.contentArgs].filter(isNode)
    : [];
  const fieldChildren = getTraversalFields(node).flatMap((field) => getFieldNodes(node, field));
  return [...children, ...callExtChildren, ...fieldChildren];
};

/**
 * Collects all descendants (including the root) matching a `type` string or predicate,
 * in document order; a `seen` set guards against shared-reference cycles so each node
 * is visited at most once.
 */
const findAll = (node: Node, predicate: string | ((node: Node) => boolean)): Node[] => {
  const seen = new Set<Node>();
  const collect = (current: Node): Node[] => {
    if (seen.has(current)) {
      return [];
    }
    seen.add(current);
    const self = matchPredicate(current, predicate) ? [current] : [];
    const descendants = getChildNodes(current).flatMap(collect);
    return [...self, ...descendants];
  };
  return collect(node);
};

export { appendChild, findAll, getChildNodes, getEnvelopeNode, getNodeTypeName, walk };
