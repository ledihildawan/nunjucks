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

export const formatLocationAnnotation = ({ lineno, colno, lineBase }: LocationInput): string => {
  const hasLine = lineno !== undefined && lineno !== null;
  const hasCol = colno !== undefined && colno !== null;

  if (!hasLine) {
    return '';
  }

  const colnoArg = hasCol ? colno : null;
  const location = toDisplayLocation({ lineno, colno: colnoArg, lineBase });
  if (hasCol) {
    return `[Line ${location.line}, Column ${location.col}]`;
  }
  return `[Line ${location.line}]`;
};

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
