/** Curries `input.replace(pattern, replacement)` into a unary stage for pipe compositions. */
export const replace =
  (pattern: RegExp | string, replacement: string): ((input: string) => string) =>
  (input: string): string =>
    input.replace(pattern, replacement);

/** Curries `input.slice(start, end)` into a unary stage for pipe compositions. */
export const slice =
  <T>(start: number, end?: number): ((input: readonly T[]) => T[]) =>
  (input: readonly T[]): T[] =>
    input.slice(start, end);
