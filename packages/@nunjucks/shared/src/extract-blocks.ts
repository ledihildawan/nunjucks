import { pipe, keys, filter, map } from 'remeda';

export const extractBlocks = (obj: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    pipe(
      obj,
      keys(),
      filter(key => key.startsWith('b_')),
      map(key => [key.slice(2), obj[key]])
    )
  );
