export function replace(pattern: RegExp | string, replacement: string): (input: string) => string {
  return (input: string): string => input.replace(pattern, replacement);
}

export function slice<T>(start: number, end?: number): (input: readonly T[]) => T[] {
  return (input: readonly T[]): T[] => input.slice(start, end);
}
