function replace(pattern: RegExp | string, replacement: string): (input: string) => string {
  return (input: string): string => input.replace(pattern, replacement);
}

function slice(start: number, end?: number): <T>(input: readonly T[]) => T[] {
  return <T>(input: readonly T[]): T[] => input.slice(start, end);
}

export { replace, slice };
