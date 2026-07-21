// WALK - Core AST traversal utilities
// Import directly: import { walk, findAll } from '@nunjucks/transformers/walk'

import { T, type Node } from '@nunjucks/nodes/types';
import { isNode, isCallExtension, isCallExtensionAsync, isNodeList, isRoot } from '@nunjucks/nodes/guards';

const HAS_CHILDREN = new Set([T.NODE_LIST, T.ROOT, T.OUTPUT, T.GROUP, T.ARRAY, T.DICT]);

export const getFields = (n: Node): string[] => {
  const excluded = new Set(['type', 'lineno', 'colno', 'fields']);
  return ((n.fields as string[]) ?? []).filter(f => !excluded.has(f));
};

export const mapCOW = <T>(arr: T[], fn: (item: T) => T): T[] => {
  let res: T[] | null = null;
  for (let i = 0; i < arr.length; i++) {
    const item = fn(arr[i]);
    if (item !== arr[i]) {
      res ??= Array.from(arr);
      res[i] = item;
    }
  }
  return res ?? arr;
};

export const walk = (ast: Node, fn: (n: Node) => Node | void): Node => {
  if (!ast || typeof ast !== 'object') return ast as Node;
  if (!isNode(ast) && !isCallExtension(ast) && !isCallExtensionAsync(ast)) return ast;

  const result = fn(ast) ?? ast;

  if (HAS_CHILDREN.has(result.type)) {
    const children = (result as unknown as { children: Node[] }).children;
    if (children) {
      const newChildren = mapCOW(children, c => walk(c, fn));
      (result as unknown as { children: Node[] }).children = newChildren;
    }
  } else if (isCallExtension(result) || isCallExtensionAsync(result)) {
    const args = walk((result as unknown as { args: Node }).args, fn);
    const contentArgs = mapCOW((result as unknown as { contentArgs: Node[] }).contentArgs, c => walk(c, fn));
    (result as unknown as { args: Node }).args = args;
    (result as unknown as { contentArgs: Node[] }).contentArgs = contentArgs;
  } else {
    const fields = getFields(result);
    const props = fields.map(f => (result as unknown as Record<string, unknown>)[f]);
    const newProps = mapCOW(props, p => {
      if (p && typeof p === 'object' && 'type' in p) return walk(p as Node, fn);
      return p;
    });
    fields.forEach((f, i) => ((result as unknown as Record<string, unknown>)[f] = newProps[i]));
  }

  return result;
};

export const depthWalk = (ast: Node, fn: (n: Node) => Node | void): Node => walk(ast, fn);

export const findAll = (ast: Node, predicate: string | ((n: Node) => boolean)): Node[] => {
  const results: Node[] = [];
  const seen = new Set<Node>();
  
  const search = (n: Node | null | undefined): void => {
    if (!n || seen.has(n)) return;
    seen.add(n);
    if (typeof predicate === 'string' ? n.type === predicate : predicate(n)) results.push(n);
    if (HAS_CHILDREN.has(n.type)) ((n as unknown as { children: Node[] }).children ?? []).forEach(search);
    for (const f of getFields(n)) {
      const v = (n as unknown as Record<string, unknown>)[f];
      if (v && typeof v === 'object') {
        if (Array.isArray(v)) (v as Node[]).forEach(search);
        else search(v as Node);
      }
    }
  };
  
  search(ast);
  return results;
};

export const findFirst = (ast: Node, predicate: (n: Node) => boolean): Node | undefined => {
  for (const n of nodes(ast)) {
    if (predicate(n)) return n;
  }
  return undefined;
};

export const count = (ast: Node, predicate?: (n: Node) => boolean): number => {
  let n = 0;
  for (const n_ of nodes(ast)) {
    if (!predicate || predicate(n_)) n++;
  }
  return n;
};

export function* nodes(ast: Node): Generator<Node> {
  if (!ast || typeof ast !== 'object') return;
  if (!isNode(ast) && !isCallExtension(ast) && !isCallExtensionAsync(ast)) return;
  
  yield ast;
  
  if (HAS_CHILDREN.has(ast.type)) {
    for (const child of (ast as unknown as { children: Node[] }).children ?? []) {
      yield* nodes(child);
    }
  } else if (isCallExtension(ast) || isCallExtensionAsync(ast)) {
    yield* nodes((ast as unknown as { args: Node }).args);
    for (const c of (ast as unknown as { contentArgs: Node[] }).contentArgs ?? []) {
      yield* nodes(c);
    }
  } else {
    for (const f of getFields(ast)) {
      const v = (ast as unknown as Record<string, unknown>)[f];
      if (v && typeof v === 'object') {
        if (Array.isArray(v)) for (const item of v) yield* nodes(item as Node);
        else yield* nodes(v as Node);
      }
    }
  }
}

export const filterNodes = (ast: Node, predicate: (n: Node) => boolean): Generator<Node> => {
  for (const n of nodes(ast)) {
    if (predicate(n)) yield n;
  }
};
