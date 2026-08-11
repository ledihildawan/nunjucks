import { readFile } from 'node:fs/promises';
import { pipe, split, last } from 'remeda';
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
  const candidateCol = candidate.col - 1;
  const distance = Math.abs(candidateLine - searchLine);
  const isCloser = distance < acc.bestDistance;
  const isSameDistanceButNearer = distance === acc.bestDistance && candidateCol < (acc.best?.col ?? Number.POSITIVE_INFINITY);
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

const findBestMatch = ({ lines, keyName, searchLine, searchRadius }: FindBestMatchInput): LinePosition | null => {
  const start = Math.max(0, searchLine - searchRadius);
  const end = Math.min(lines.length - 1, searchLine + searchRadius);

  const findOccurrencesInLine = (lineIndex: number): LinePosition[] => {
    const line = lines[lineIndex] ?? '';
    const pattern = new RegExp(escapeRegex(keyName), 'g');
    return [...line.matchAll(pattern)].map(match => ({ line: lineIndex + 1, col: (match.index ?? 0) + 1 }));
  };

  const candidates = Array.from({ length: end - start + 1 }, (_, offset) => start + offset).flatMap(findOccurrencesInLine);

  return candidates.reduce<{ best: LinePosition | null; bestDistance: number }>(
    (acc, candidate) => findBetterMatch(acc, candidate, searchLine),
    { best: null, bestDistance: Number.POSITIVE_INFINITY }
  ).best;
};

interface FindContextKeyPositionInput {
  sourceFile: string;
  callLine: number;
  dangerousPath: string;
}

export const findContextKeyPosition = async (
  { sourceFile, callLine, dangerousPath }: FindContextKeyPositionInput
): Promise<LinePosition | null> => {
  try {
    const content = await readFile(sourceFile, 'utf-8');
    const lines = content.split('\n');
    const keyName = pipe(dangerousPath, split('.'), last()) ?? '';
    const searchLine = Math.max(0, callLine - 1);
    const searchRadius = 5;

    // WHY: prefer property-key occurrences (keyName followed by ':') over bare name matches. A dangerous path like 'user.global' produces keyName 'global', which also appears inside template expressions '{{ user.global }}'. Requiring the trailing ':' ensures we point at the context definition (e.g. `{ global: process }`) rather than the template expression.
    const propKeyMatch = findBestMatch({ lines, keyName: `${keyName}:`, searchLine, searchRadius });
    if (propKeyMatch) { return propKeyMatch; }

    return findBestMatch({ lines, keyName, searchLine, searchRadius });
  } catch {
    return null;
  }
};