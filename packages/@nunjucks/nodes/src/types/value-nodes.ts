import type { NodeBase } from './base.ts';
import type { T } from './constants.ts';

interface GenericNode extends NodeBase {
  readonly type: typeof T.NODE;
}

interface ValueNode extends NodeBase {
  readonly type: typeof T.VALUE;
  readonly value: unknown;
}

interface LiteralNode extends NodeBase {
  readonly type: typeof T.LITERAL;
  readonly value: unknown;
}

interface SymbolNode extends NodeBase {
  readonly type: typeof T.SYMBOL;
  readonly value: string;
}

interface TemplateDataNode extends NodeBase {
  readonly type: typeof T.TEMPLATE_DATA;
  readonly value: string;
}

interface HoleNode extends NodeBase {
  readonly type: typeof T.HOLE;
}

export type { GenericNode, HoleNode, LiteralNode, SymbolNode, TemplateDataNode, ValueNode };
