export const extractBlocks = (obj: Record<string, unknown>): Partial<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(obj)
      .filter(([key]) => key.startsWith('b_'))
      .map(([key, value]) => [key.slice(2), value])
  );
