/** Narrows a readonly array to a non-empty tuple for `Err` error envelopes. */
const isNonEmpty = <T>(arr: readonly T[]): arr is readonly [T, ...T[]] => arr.length > 0;

export { isNonEmpty };
