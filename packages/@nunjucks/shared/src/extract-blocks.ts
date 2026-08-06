export const extractBlocks = <T extends Record<string, unknown> | object>(obj: T): Partial<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(obj as Record<string, unknown>)
      .filter(([key]) => key.startsWith('b_'))
      .map(([key, value]) => [key.slice(2), value])
  );
