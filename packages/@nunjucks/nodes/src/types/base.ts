import type { NodeType } from './constants.ts';
import { BracketNotation } from './constants.ts';
import type { Node } from './node-types.ts';

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
