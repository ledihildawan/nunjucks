// TRAVERSE - Walk and transform AST
// Import directly: import { walk, findAll } from '@nunjucks/nodes/traverse'

import { T, type Node } from './types.ts';

const CHILDREN_TYPES = new Set([T.NODE_LIST, T.ROOT, T.OUTPUT, T.GROUP, T.ARRAY, T.DICT]);

const getFields = (n: Node): string[] => {
  const excluded = new Set(['type', 'lineno', 'colno', 'fields']);
  return (n.fields as string[]).filter(f => !excluded.has(f));
};

export const getType = (n: unknown): string | undefined => (n as Node)?.type;
export const getFields_ = (n: Node): readonly string[] => getFields(n);

export const walk = (node: Node, fn: (n: Node) => Node | void): Node => {
  const result = fn(node) ?? node;
  
  if (CHILDREN_TYPES.has(result.type)) {
    const children = (result as unknown as { children: Node[] }).children;
    const newChildren = children.map(c => walk(c, fn));
    (result as unknown as { children: Node[] }).children = newChildren;
  }
  
  for (const field of getFields(result)) {
    const val = result[field];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      walk(val as Node, fn);
    }
  }
  
  return result;
};

export const findAll = (node: Node, predicate: string | ((n: Node) => boolean)): Node[] => {
  const results: Node[] = [];
  const seen = new Set<Node>();
  
  const search = (n: Node | null | undefined): void => {
    if (!n || seen.has(n)) return;
    seen.add(n);
    
    if (typeof predicate === 'string' ? n.type === predicate : predicate(n)) {
      results.push(n);
    }
    
    if (CHILDREN_TYPES.has(n.type)) {
      ((n as unknown as { children: Node[] }).children).forEach(search);
    }
    
    for (const field of getFields(n)) {
      const val = n[field];
      if (val && typeof val === 'object') {
        if (Array.isArray(val)) val.forEach(item => search(item as Node));
        else search(val as Node);
      }
    }
  };
  
  search(node);
  return results;
};

export const findFirst = (node: Node, predicate: (n: Node) => boolean): Node | undefined => {
  const found = { result: undefined as Node | undefined };
  
  const search = (n: Node | null | undefined): boolean => {
    if (!n || found.result) return true;
    if (predicate(n)) found.result = n;
    else {
      if (CHILDREN_TYPES.has(n.type)) ((n as unknown as { children: Node[] }).children).some(search);
      for (const field of getFields(n)) {
        const val = n[field];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          if (search(val as Node)) return true;
        }
      }
    }
    return false;
  };
  
  search(node);
  return found.result;
};

export const count = (node: Node, predicate?: (n: Node) => boolean): number => {
  let n = 0;
  findAll(node, (node) => { if (!predicate || predicate(node)) n++; });
  return n;
};

export function* nodes(node: Node): Generator<Node> {
  yield node;
  
  if (CHILDREN_TYPES.has(node.type)) {
    for (const child of (node as unknown as { children: Node[] }).children) {
      yield* nodes(child);
    }
  }
  
  for (const field of getFields(node)) {
    const val = node[field];
    if (val && typeof val === 'object') {
      if (Array.isArray(val)) {
        for (const item of val) yield* nodes(item as Node);
      } else {
        yield* nodes(val as Node);
      }
    }
  }
}

export const filterNodes = (node: Node, predicate: (n: Node) => boolean): Generator<Node> => {
  for (const n of nodes(node)) {
    if (predicate(n)) yield n;
  }
};
