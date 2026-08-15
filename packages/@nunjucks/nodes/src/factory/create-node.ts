import type { Loc } from '@nunjucks/shared';
import { FIELDS, type NodeOf, type NodeType, T } from '../types/index.ts';

const createNode = <K extends NodeType>(
  nodeType: K,
  loc: Loc,
  data: Record<string, unknown> = {}
): NodeOf<K> =>
  ({
    type: nodeType,
    lineno: loc.lineno,
    colno: loc.colno,
    fields: FIELDS[nodeType],
    ...data,
  }) as NodeOf<K>;

export { createNode, T };
