export const replace =
  (pattern: RegExp | string, replacement: string): ((input: string) => string) =>
  (input: string): string =>
    input.replace(pattern, replacement);

export const slice =
  <T>(start: number, end?: number): ((input: readonly T[]) => T[]) =>
  (input: readonly T[]): T[] =>
    input.slice(start, end);
