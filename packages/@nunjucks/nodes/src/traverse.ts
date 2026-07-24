// TRAVERSE - Canonical AST walk / search / transform utilities (copy-on-write).
import { T, type Node } from './types.ts';
import { isNode, isCallExtension, isCallExtensionAsync } from './guards.ts';

const CHILDREN_TYPES: ReadonlySet<string> = new Set([T.NODE_LIST, T.ROOT, T.OUTPUT, T.GROUP, T.ARRAY, T.DICT]);

const getFields = (n: Node): string[] => {
  const excluded = new Set(['type', 'lineno', 'colno', 'fields']);
  return ((n.fields as string[]) ?? []).filter(f => !excluded.has(f));
};

export const getType = (n: unknown): string | undefined => (n as Node)?.type;
export const getFields_ = (n: Node): readonly string[] => getFields(n);

export const getNodeTypeName = getType;
export const getNodeFields = getFields_;

export const addChild = (list: Node, child: Node): Node => {
  const children = (list as unknown as { children: Node[] }).children;
  return { ...list, children: [...children, child] } as Node;
};

export const pushChild = (node: Node, child: Node): void => {
  const children = (node as { children?: Node[] }).children;
  if (children) { children.push(child); }
};

export const mapCOW = <T>(arr: readonly T[], fn: (item: T) => T): T[] => {
  let res: T[] | null = null;
  for (let i = 0; i < arr.length; i++) {
    const item = fn(arr[i]!);
    if (item !== arr[i]) {
      res ??= Array.from(arr);
      res[i] = item;
    }
  }
  return res ?? (arr as T[]);
};

const walkValue = (val: unknown, walker: (n: Node) => Node): unknown => {
  if (Array.isArray(val)) {
    return mapCOW<unknown>(val as unknown[], item => {
      if (item && typeof item === 'object' && 'type' in item) { return walker(item as Node); }
      return item;
    });
  }
  if (val && typeof val === 'object' && 'type' in val) { return walker(val as Node); }
  return val;
};

const isCallExtNode = (n: Node): boolean => isCallExtension(n) || isCallExtensionAsync(n);

const walkChildren = (node: Node, walker: (n: Node) => Node): Node => {
  const children = (node as unknown as { children?: Node[] }).children;
  if (Array.isArray(children)) {
    const newChildren = mapCOW(children, c => walker(c));
    if (newChildren !== children) {
      return { ...node, children: newChildren } as Node;
    }
    return node;
  }
  if (isCallExtNode(node)) {
    const args = (node as unknown as { args: Node }).args;
    const newArgs = walkValue(args, walker);
    const contentArgs = (node as unknown as { contentArgs: Node[] }).contentArgs;
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
  const props = fieldsList.map(f => (node as unknown as Record<string, unknown>)[f]);
  const newProps = mapCOW<unknown>(props, p => walkValue(p, walker));
  if (newProps !== props) {
    const newNode: Record<string, unknown> = { ...node };
    fieldsList.forEach((f, i) => (newNode[f] = newProps[i]));
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

    if (CHILDREN_TYPES.has(n.type)) {
      ((n as unknown as { children: Node[] }).children).forEach(search);
    }

    if (isCallExtNode(n)) {
      const args = (n as unknown as { args?: Node }).args;
      if (args) { search(args); }
      const contentArgs = (n as unknown as { contentArgs?: Node[] }).contentArgs;
      if (contentArgs) { contentArgs.forEach(search); }
    }

    for (const field of getFields(n)) {
      const val = (n as unknown as Record<string, unknown>)[field];
      if (val && typeof val === 'object') {
        if (Array.isArray(val)) { (val as Node[]).forEach(search); }
        else { search(val as Node); }
      }
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
      if (CHILDREN_TYPES.has(n.type)) { ((n as unknown as { children: Node[] }).children).some(search); }
      if (isCallExtNode(n)) {
        const args = (n as unknown as { args?: Node }).args;
        if (args && search(args)) { return true; }
        const contentArgs = (n as unknown as { contentArgs?: Node[] }).contentArgs;
        if (contentArgs) { for (const c of contentArgs) { if (search(c)) { return true; } } }
      }
      for (const field of getFields(n)) {
        const val = (n as unknown as Record<string, unknown>)[field];
        if (val && typeof val === 'object' && !Array.isArray(val) && search(val as Node)) { return true; }
      }
    }
    return false;
  };

  search(node);
  return found.result;
};

export const count = (node: Node, predicate?: (n: Node) => boolean): number => {
  let n = 0;
  findAll(node, (nd): boolean => { if (!predicate || predicate(nd)) { n++;  }return true; });
  return n;
};

export function* iterateNodes(node: Node): Generator<Node> {
  yield node;

  if (CHILDREN_TYPES.has(node.type)) {
    for (const child of (node as unknown as { children: Node[] }).children) {
      yield* iterateNodes(child);
    }
  } else if (isCallExtNode(node)) {
    const args = (node as unknown as { args?: Node }).args;
    if (args) { yield* iterateNodes(args); }
    const contentArgs = (node as unknown as { contentArgs?: Node[] }).contentArgs;
    if (contentArgs) { for (const c of contentArgs) { yield* iterateNodes(c); } }
  } else {
    for (const field of getFields(node)) {
      const val = (node as unknown as Record<string, unknown>)[field];
      if (val && typeof val === 'object') {
        if (Array.isArray(val)) {
          for (const item of val) { yield* iterateNodes(item as Node); }
        } else {
          yield* iterateNodes(val as Node);
        }
      }
    }
  }
}

export function* filterNodes(ast: Node, predicate: (n: Node) => boolean): Generator<Node> {
  for (const n of iterateNodes(ast)) {
    if (predicate(n)) { yield n; }
  }
}
