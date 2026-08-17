import type { NodeType } from './constants.ts';
import { BracketNotation } from './constants.ts';
import type { Node } from './node-types.ts';

/**
 * Shape shared by every AST node: a `type` tag, source `lineno`/`colno`, and the
 * optional `fields` slot list that drives generic traversal. Optional well-known
 * slots (`children`, `body`, `value`) only exist on the node kinds that use them.
 */
interface NodeBase {
  readonly type: NodeType;
  readonly lineno: number;
  readonly colno: number;
  fields?: readonly string[];
  readonly children?: readonly Node[];
  readonly body?: Node | null;
  readonly value?: unknown;
  [BracketNotation]?: boolean;
}

export type { NodeBase };
