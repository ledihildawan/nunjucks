import { T, FIELDS, type NodeOf, type NodeType } from '../types/index.ts';

const createNode = <K extends NodeType>(nodeType: K, lineno: number, colno: number, data: Record<string, unknown> = {}): NodeOf<K> => ({
  type: nodeType, lineno, colno, fields: FIELDS[nodeType], ...data,
} as NodeOf<K>);

export { createNode, T };
