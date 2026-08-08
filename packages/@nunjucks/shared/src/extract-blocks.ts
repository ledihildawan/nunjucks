export const extractBlocks = (
  source: Record<string, unknown>
): Partial<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => key.startsWith('b_'))
      .map(([key, value]) => [key.slice(2), value])
  );
