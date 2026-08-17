/** Selects whether reported line numbers are zero-based or one-based. */
export type LineBase = 'zero' | 'one';

/** Normalizes any line-base input to the canonical zero/one enum. */
export const normalizeLineBase = (lineBase?: LineBase | null): LineBase =>
  lineBase === 'one' ? 'one' : 'zero';
