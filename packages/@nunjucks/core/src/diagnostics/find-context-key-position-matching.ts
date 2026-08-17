import { escapeRegex } from '@nunjucks/lib';

interface LinePosition {
  line: number;
  col: number;
}

const findBetterMatch = (
  acc: { best: LinePosition | null; bestDistance: number },
  candidate: LinePosition,
  searchLine: number
): { best: LinePosition | null; bestDistance: number } => {
  const candidateLine = candidate.line - 1;
  const distance = Math.abs(candidateLine - searchLine);
  const isCloser = distance < acc.bestDistance;
  // WHY: `candidate.col < best.col` — both are 1-based; a `<=` would let later
  // occurrences steal ties from earlier ones on the same line.
  const isSameDistanceButNearer =
    distance === acc.bestDistance && candidate.col < (acc.best?.col ?? Number.POSITIVE_INFINITY);
  if (isCloser || isSameDistanceButNearer) {
    return { best: candidate, bestDistance: distance };
  }
  return acc;
};

interface FindBestMatchInput {
  lines: string[];
  keyName: string;
  searchLine: number;
  searchRadius: number;
}

const findBestMatch = ({
  lines,
  keyName,
  searchLine,
  searchRadius,
}: FindBestMatchInput): LinePosition | null => {
  const start = Math.max(0, searchLine - searchRadius);
  const end = Math.min(lines.length - 1, searchLine + searchRadius);

  const findOccurrencesInLine = (lineIndex: number): LinePosition[] => {
    const line = lines[lineIndex] ?? '';
    // WHY: leading \b outside the escaped literal (escapeRegex would neutralize it
    // if it rode inside keyName) — without the boundary, key 'eval' would also match
    // inside 'retrieval'. A trailing boundary would break the `${keyName}:` prop-key
    // pass (':' is not a word char, so \b already holds between name and colon).
    const pattern = new RegExp(`\\b${escapeRegex(keyName)}`, 'g');
    return [...line.matchAll(pattern)].map((match) => ({
      line: lineIndex + 1,
      col: (match.index ?? 0) + 1,
    }));
  };

  const candidates = Array.from({ length: end - start + 1 }, (_, offset) => start + offset).flatMap(
    findOccurrencesInLine
  );

  return candidates.reduce<{ best: LinePosition | null; bestDistance: number }>(
    (acc, candidate) => findBetterMatch(acc, candidate, searchLine),
    { best: null, bestDistance: Number.POSITIVE_INFINITY }
  ).best;
};

export type { LinePosition };
export { findBestMatch, findBetterMatch };
