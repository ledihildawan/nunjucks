import { type LineBase, normalizeLineBase } from '@nunjucks/error-catalog';

interface DisplayLocation {
  line: number;
  col: number;
}

interface LocationInput {
  lineno?: number | null;
  colno?: number | null;
  lineBase?: LineBase | null;
}

/**
 * Normalizes engine coordinates to 1-based display coordinates: `'zero'`-based input is
 * shifted up by one (defaulting to line 1, col 1) while `'one'`-based input passes
 * through unchanged with the same floor.
 */
export const toDisplayLocation = ({ lineno, colno, lineBase }: LocationInput): DisplayLocation => {
  const lineBaseValue = normalizeLineBase(lineBase);
  const safeLine = lineno ?? 0;
  const safeCol = colno ?? 0;

  if (lineBaseValue === 'one') {
    return {
      line: safeLine || 1,
      col: safeCol || 1,
    };
  }

  return {
    line: safeLine + 1,
    col: safeCol + 1,
  };
};
