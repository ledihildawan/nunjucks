export const normalizeLine = (raw) => raw ?? null;
export const normalizeCol = (raw) => raw ?? null;

export const getDisplayLine = (tplLine) => tplLine ?? null;
export const getDisplayCol = (tplCol) => tplCol ?? null;

export const getFallbackLine = (extracted, raw) => extracted ?? raw ?? null;
export const getFallbackCol = (extracted, raw) => extracted ?? raw ?? null;

export const mergeLine = (rawLine, extractedLine) => {
  if (rawLine != null) return rawLine;
  if (extractedLine != null) return extractedLine;
  return null;
};

export const mergeCol = (rawCol, extractedCol, msgCol) => {
  if (rawCol != null) return rawCol;
  if (extractedCol != null) return extractedCol;
  if (msgCol != null) return msgCol;
  return null;
};

export const createDisplayLine = (tplLine) => {
  return getDisplayLine(tplLine) ?? '?';
};

export const createDisplayCol = (tplCol) => {
  return getDisplayCol(tplCol) ?? '?';
};
