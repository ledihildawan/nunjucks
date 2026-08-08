export type LineBase = 'zero' | 'one';

export const normalizeLineBase = (lineBase?: LineBase | null): LineBase =>
  lineBase === 'one' ? 'one' : 'zero';
