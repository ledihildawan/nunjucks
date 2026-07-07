export const normalizeLine = (raw) => raw ?? null;
export const normalizeCol = (raw) => raw ?? null;

export const getDisplayLine = (tplLine) => tplLine !== null ? tplLine + 1 : null;
export const getDisplayCol = (tplCol) => tplCol !== null ? tplCol + 1 : null;

export const getFallbackLine = (extracted, raw) => extracted ?? raw ?? null;
export const getFallbackCol = (extracted, raw) => extracted ?? raw ?? null;

export const mergeLine = (rawLine, extractedLine) => {
  return rawLine ?? extractedLine ?? null;
};

export const mergeCol = (rawCol, extractedCol, msgCol) => {
  return rawCol ?? extractedCol ?? msgCol ?? null;
};

export const createDisplayLine = (tplLine) => {
  return getDisplayLine(tplLine) ?? '?';
};

export const createDisplayCol = (tplCol) => {
  return getDisplayCol(tplCol) ?? '?';
};
