const isNonEmpty = <T>(arr: readonly T[]): arr is readonly [T, ...T[]] => arr.length > 0;

export { isNonEmpty };
