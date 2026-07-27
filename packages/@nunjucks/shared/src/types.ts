/**
 * AST node location with optional (nullable) line/column.
 * Used where the parser may not have resolved a position.
 */
interface NodeLocation {
  lineno: number | null;
  colno: number | null;
}

/**
 * AST node position with required (non-nullable) line/column.
 * Used where the position is always known.
 */
interface NodePosition {
  lineno: number;
  colno: number;
}

/**
 * Optional version of NodeLocation - all fields are optional.
 * Used in contexts where location info may be missing.
 */
interface OptionalNodeLocation {
  lineno?: number | null;
  colno?: number | null;
}

/**
 * Location argument for function callbacks (filters, tests).
 * Represents optional line/column info passed as a single object.
 */
interface LocationArg {
  lineno: number | null;
  colno: number | null;
}

export type { NodeLocation, NodePosition, OptionalNodeLocation, LocationArg };
