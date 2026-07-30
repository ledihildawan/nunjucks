/**
 * AST node location with optional (nullable) line/column.
 * Used where the parser may not have resolved a position.
 */
interface NodeLocation {
  lineno: number | null;
  colno: number | null;
}

export type { NodeLocation };
