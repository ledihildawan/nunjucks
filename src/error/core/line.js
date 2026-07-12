export const normalizeLine = (raw) => raw ?? null;
export const normalizeCol = (raw) => raw ?? null;

export const getDisplayLine = (tplLine) => tplLine ?? null;
export const getDisplayCol = (tplCol) => tplCol ?? null;

export const getFallbackLine = (extracted, raw) => extracted ?? raw ?? null;
export const getFallbackCol = (extracted, raw) => extracted ?? raw ?? null;

export const mergeLine = (rawLine, extractedLine) => {
  if (rawLine !== null && rawLine !== undefined) return rawLine;
  if (extractedLine !== null && extractedLine !== undefined) return extractedLine;
  return null;
};

export const mergeCol = (rawCol, extractedCol, msgCol) => {
  if (rawCol !== null && rawCol !== undefined) return rawCol;
  if (extractedCol !== null && extractedCol !== undefined) return extractedCol;
  if (msgCol !== null && msgCol !== undefined) return msgCol;
  return null;
};

export const createDisplayLine = (tplLine) => {
  return getDisplayLine(tplLine) ?? '?';
};

export const createDisplayCol = (tplCol) => {
  return getDisplayCol(tplCol) ?? '?';
};
