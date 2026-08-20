import type { Loc } from '@nunjucks/shared';
import { FIELDS, type NodeOf, type NodeType, T } from '../types/index.ts';

/**
 * Creates a node of the given type tagged with `lineno`/`colno` and the frozen `FIELDS`
 * slot list for that type; extra `data` is spread over the defaults so callers can
 * override any slot.
 */
const createNode = <K extends NodeType>(
  nodeType: K,
  loc: Loc,
  data: Record<string, unknown> = {}
): NodeOf<K> =>
  // WHY: the cast is sound — the only callers are the typed factories, whose fields
  // objects are constrained to K's slots, so the spread result always satisfies K.
  ({
    type: nodeType,
    lineno: loc.lineno,
    colno: loc.colno,
    fields: FIELDS[nodeType],
    ...data,
  }) as NodeOf<K>;

export { createNode, T };
