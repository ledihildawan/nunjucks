export type LineBase = 'zero' | 'one';

export interface DisplayLocation {
	line: number;
	col: number;
}

export const formatLocationAnnotation = (
	lineno?: number | null,
	colno?: number | null,
	lineBase?: LineBase | null
): string => {
	const hasLine = lineno !== undefined && lineno !== null;
	const hasCol = colno !== undefined && colno !== null;

	if (!hasLine) return '';

	const location = toDisplayLocation(lineno, hasCol ? colno : null, lineBase);
	if (hasCol) {
		return `[Line ${location.line}, Column ${location.col}]`;
	}
	return `[Line ${location.line}]`;
};

export const normalizeLineBase = (lineBase?: LineBase | null): LineBase => {
	return lineBase === 'one' ? 'one' : 'zero';
};

export const toDisplayLocation = (
	lineno?: number | null,
	colno?: number | null,
	lineBase?: LineBase | null
): DisplayLocation => {
	const base = normalizeLineBase(lineBase);
	const safeLine = lineno ?? 0;
	const safeCol = colno ?? 0;

	if (base === 'one') {
		return {
			line: safeLine || 1,
			col: safeCol || 1
		};
	}

	return {
		line: safeLine + 1,
		col: safeCol + 1
	};
};
