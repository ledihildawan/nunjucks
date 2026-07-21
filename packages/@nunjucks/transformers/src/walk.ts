// WALK - Core AST traversal utilities
// Import directly: import { walk, findAll } from '@nunjucks/transformers/walk'

import { type Node } from '@nunjucks/nodes/types';
import { isNode, isCallExtension, isCallExtensionAsync } from '@nunjucks/nodes/guards';

const getFields = (n: Node): string[] => {
  const excluded = new Set(['type', 'lineno', 'colno', 'fields']);
  return ((n.fields as string[]) ?? []).filter(f => !excluded.has(f));
};

export const mapCOW = <T>(arr: readonly T[], fn: (item: T) => T): T[] => {
  let res: T[] | null = null;
  for (let i = 0; i < arr.length; i++) {
    const item = fn(arr[i]);
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
      if (item && typeof item === 'object' && 'type' in item) return walker(item as Node);
      return item;
    });
  }
  if (val && typeof val === 'object' && 'type' in val) return walker(val as Node);
  return val;
};

const walkChildren = (node: Node, walker: (n: Node) => Node): Node => {
  const children = (node as unknown as { children?: Node[] }).children;
  if (Array.isArray(children)) {
    const newChildren = mapCOW(children, c => walker(c));
    if (newChildren !== children) {
      return { ...node, children: newChildren } as Node;
    }
    return node;
  }
  if (isCallExtension(node) || isCallExtensionAsync(node)) {
    const args = (node as unknown as { args: Node }).args;
    const newArgs = walkValue(args, walker);
    const contentArgs = (node as unknown as { contentArgs: Node[] }).contentArgs;
    const newContentArgs = contentArgs ? mapCOW(contentArgs, c => walker(c)) : contentArgs;
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

export const walk = (ast: Node, fn: (n: Node) => Node | void): Node => {
  if (!ast || typeof ast !== 'object') return ast as Node;
  if (!isNode(ast) && !isCallExtension(ast) && !isCallExtensionAsync(ast)) return ast;

  const replaced = fn(ast);
  if (replaced && replaced !== ast) {
    return replaced as Node;
  }
  const afterFn = (replaced ?? ast) as Node;
  return walkChildren(afterFn, c => walk(c, fn));
};

export const depthWalk = (ast: Node, fn: (n: Node) => Node | void): Node => {
  if (!ast || typeof ast !== 'object') return ast as Node;
  if (!isNode(ast) && !isCallExtension(ast) && !isCallExtensionAsync(ast)) return ast;

  const walked = walkChildren(ast, c => depthWalk(c, fn));
  const replaced = fn(walked);
  return (replaced ?? walked) as Node;
};

export const findAll = (ast: Node, predicate: string | ((n: Node) => boolean)): Node[] => {
  const results: Node[] = [];
  const seen = new Set<Node>();

  const search = (n: Node | null | undefined): void => {
    if (!n || seen.has(n)) return;
    seen.add(n);
    if (typeof predicate === 'string' ? n.type === predicate : predicate(n)) results.push(n);

    const children = (n as unknown as { children?: Node[] }).children;
    if (Array.isArray(children)) children.forEach(search);

    if (isCallExtension(n) || isCallExtensionAsync(n)) {
      const args = (n as unknown as { args?: Node }).args;
      if (args) search(args);
      const contentArgs = (n as unknown as { contentArgs?: Node[] }).contentArgs;
      if (contentArgs) contentArgs.forEach(search);
    }

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

  const children = (ast as unknown as { children?: Node[] }).children;
  if (Array.isArray(children)) {
    for (const child of children) yield* nodes(child);
  } else if (isCallExtension(ast) || isCallExtensionAsync(ast)) {
    const args = (ast as unknown as { args?: Node }).args;
    if (args) yield* nodes(args);
    const contentArgs = (ast as unknown as { contentArgs?: Node[] }).contentArgs;
    if (contentArgs) for (const c of contentArgs) yield* nodes(c);
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

export function* filterNodes(ast: Node, predicate: (n: Node) => boolean): Generator<Node> {
  for (const n of nodes(ast)) {
    if (predicate(n)) yield n;
  }
}
