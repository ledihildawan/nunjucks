import type { NodeBase } from './base.ts';
import type { T } from './constants.ts';

/** Constant value embedded in the template; the runtime value is `unknown`. */
interface LiteralNode extends NodeBase {
  readonly type: typeof T.LITERAL;
  readonly value: unknown;
}

/** Reference to a named variable, resolved against the render context. */
interface SymbolNode extends NodeBase {
  readonly type: typeof T.SYMBOL;
  readonly value: string;
}

/** Static text chunk emitted verbatim between interpolations. */
interface TemplateDataNode extends NodeBase {
  readonly type: typeof T.TEMPLATE_DATA;
  readonly value: string;
}

/** Placeholder marking an omitted element in array or object patterns. */
interface HoleNode extends NodeBase {
  readonly type: typeof T.HOLE;
}

export type { HoleNode, LiteralNode, SymbolNode, TemplateDataNode };
