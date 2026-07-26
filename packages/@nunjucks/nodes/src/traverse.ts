// TRAVERSE - Canonical AST walk / search / transform utilities (copy-on-write).
import type { CallExtensionNode, ChildrenNode, Node } from './types.ts';
import { isNode, isCallExtension, isCallExtensionAsync } from './guards.ts';

const getFields = (n: Node): string[] => {
  const excluded = new Set(['type', 'lineno', 'colno', 'fields']);
  return (n.fields ?? []).filter(f => !excluded.has(f));
};

export const getType = (n: unknown): string | undefined => {
  if (isNode(n)) {
    return n.type;
  }
};
export const getFields_ = (n: Node): readonly string[] => getFields(n);

export const getNodeTypeName = getType;
export const getNodeFields = getFields_;

export const appendChild = <K extends ChildrenNode>(node: K, child: Node): K =>
  ({ ...node, children: [...node.children, child] });

export const mapCOW = <T>(arr: readonly T[], fn: (item: T) => T): T[] => {
  let res: T[] | null = null;
  arr.forEach((original, i) => {
    const item = fn(original);
    if (item !== original) {
      res ??= Array.from(arr);
      res[i] = item;
    }
  });
  return res ?? (arr as T[]);
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
    let newContentArgs: Node[] | null;
    if (contentArgs) {
      newContentArgs = mapCOW(contentArgs, c => walker(c));
    } else {
      newContentArgs = contentArgs;
    }
    if (newArgs !== args || newContentArgs !== contentArgs) {
      return { ...node, args: newArgs, contentArgs: newContentArgs } as Node;
    }
    return node;
  }
  const fieldsList = getFields(node);
  const props = fieldsList.map(f => node[f]);
  const newProps = mapCOW<unknown>(props, p => walkValue(p, walker));
  if (newProps !== props) {
    const newNode: Record<string, unknown> = { ...node };
    fieldsList.forEach((f, i) => {
      newNode[f] = newProps[i];
    });
    return newNode as Node;
  }
  return node;
};

export const walk = (ast: Node, fn: (n: Node) => Node | undefined): Node => {
  if (!ast || typeof ast !== 'object') { return ast as Node; }
  if (!(isNode(ast) || isCallExtNode(ast))) { return ast; }

  const replaced = fn(ast);
  if (replaced && replaced !== ast) {
    return replaced as Node;
  }
  const afterFn = (replaced ?? ast) as Node;
  return walkChildren(afterFn, c => walk(c, fn));
};

export const depthWalk = (ast: Node, fn: (n: Node) => Node | undefined): Node => {
  if (!ast || typeof ast !== 'object') { return ast as Node; }
  if (!(isNode(ast) || isCallExtNode(ast))) { return ast; }

  const walked = walkChildren(ast, c => depthWalk(c, fn));
  const replaced = fn(walked);
  return (replaced ?? walked) as Node;
};

export const findAll = (node: Node, predicate: string | ((n: Node) => boolean)): Node[] => {
  const results: Node[] = [];
  const seen = new Set<Node>();

  const search = (n: Node | null | undefined): void => {
    if (!n || seen.has(n)) { return; }
    seen.add(n);

    let predicateResult: boolean;
    if (typeof predicate === 'string') {
      predicateResult = n.type === predicate;
    } else {
      predicateResult = predicate(n);
    }
    if (predicateResult) {
      results.push(n);
    }

    if (Array.isArray(n.children)) {
      n.children.forEach(search);
    }

    if (isCallExtNode(n)) {
      search(n.args);
      n.contentArgs.forEach(search);
    }

    for (const field of getTraversalFields(n)) {
      const val = n[field];
      if (Array.isArray(val)) { val.forEach(item => { if (isNode(item)) { search(item); } }); }
      else if (isNode(val)) { search(val); }
    }
  };

  search(node);
  return results;
};

export const findFirst = (node: Node, predicate: (n: Node) => boolean): Node | undefined => {
  const found = { result: undefined as Node | undefined };

  const search = (n: Node | null | undefined): boolean => {
    if (!n || found.result) { return true; }
    if (predicate(n)) { found.result = n; }
    else {
      if (Array.isArray(n.children)) { n.children.some(search); }
      if (isCallExtNode(n)) {
        if (search(n.args)) { return true; }
        for (const child of n.contentArgs) { if (search(child)) { return true; } }
      }
      for (const field of getTraversalFields(n)) {
        const val = n[field];
        if (Array.isArray(val)) {
          for (const child of val) { if (isNode(child) && search(child)) { return true; } }
        } else if (isNode(val) && search(val)) { return true; }
      }
    }
    return false;
  };

  search(node);
  return found.result;
};

export const count = (node: Node, predicate?: (n: Node) => boolean): number => {
  let n = 0;
  findAll(node, (nd): boolean => { if (!predicate || predicate(nd)) { n += 1; } return true; });
  return n;
};

export function* iterateNodes(node: Node): Generator<Node> {
  yield node;

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      yield* iterateNodes(child);
    }
  }
  if (isCallExtNode(node)) {
    yield* iterateNodes(node.args);
    for (const child of node.contentArgs) { yield* iterateNodes(child); }
  }
  for (const field of getTraversalFields(node)) {
    const val = node[field];
    if (Array.isArray(val)) {
      for (const item of val) { if (isNode(item)) { yield* iterateNodes(item); } }
    } else if (isNode(val)) {
      yield* iterateNodes(val);
    }
  }
}

export function* filterNodes(ast: Node, predicate: (n: Node) => boolean): Generator<Node> {
  for (const n of iterateNodes(ast)) {
    if (predicate(n)) { yield n; }
  }
}
