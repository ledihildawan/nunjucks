import { T, FIELDS, type NodeOf, type NodeType } from '../types/index.ts';
import type { Loc } from '@nunjucks/shared';

const createNode = <K extends NodeType>(nodeType: K, loc: Loc, data: Record<string, unknown> = {}): NodeOf<K> => ({
  type: nodeType, lineno: loc.lineno, colno: loc.colno, fields: FIELDS[nodeType], ...data,
} as NodeOf<K>);

export { createNode, T };
