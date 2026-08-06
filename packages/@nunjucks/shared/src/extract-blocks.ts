export const extractBlocks = (obj: Record<string, unknown> | object): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(obj as Record<string, unknown>)
      .filter(([key]) => key.startsWith('b_'))
      .map(([key, value]) => [key.slice(2), value])
  );
