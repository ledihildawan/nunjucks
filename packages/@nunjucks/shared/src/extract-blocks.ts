export const extractBlocks = (obj: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.keys(obj)
      .filter(key => key.startsWith('b_'))
      .map(key => [key.slice(2), obj[key]])
  );
