export const extractBlocks = (obj: Record<string, unknown>): Record<string, unknown> => {
  const blocks: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (key.startsWith('b_')) {
      blocks[key.slice(2)] = obj[key];
    }
  }
  return blocks;
};
