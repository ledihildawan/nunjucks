import { pipe, filter, map } from 'remeda';

export const extractBlocks = <T = unknown>(
  source: Record<string, T>
): Partial<Record<string, T>> =>
  pipe(
    Object.entries(source),
    filter(([key]: readonly [string, T]) => key.startsWith('b_')),
    map(([key, value]: readonly [string, T]) => [key.slice(2), value]),
    Object.fromEntries,
  ) as Partial<Record<string, T>>;
