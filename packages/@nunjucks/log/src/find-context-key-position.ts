import { readFile } from 'node:fs/promises';
import { pipe, split, last } from 'remeda';

interface LinePosition {
  line: number;
  col: number;
}

const findBestMatch = (lines: string[], keyName: string, searchLine: number, searchRadius: number): LinePosition | null => {
  const start = Math.max(0, searchLine - searchRadius);
  const end = Math.min(lines.length - 1, searchLine + searchRadius);

  const findOccurrencesInLine = (lineIndex: number): LinePosition[] => {
    const line = lines[lineIndex] ?? '';
    const positions: number[] = [];
    let col = 0;
    let found = line.indexOf(keyName, col);
    while (found !== -1) {
      positions.push(found);
      col = found + 1;
      found = line.indexOf(keyName, col);
    }
    return positions.map(position => ({ line: lineIndex + 1, col: position + 1 }));
  };

  const candidates = Array.from({ length: end - start + 1 }, (_, offset) => start + offset).flatMap(findOccurrencesInLine);

  return candidates.reduce<{ best: LinePosition | null; bestDistance: number }>(
    (acc, candidate) => {
      const i = candidate.line - 1;
      const found = candidate.col - 1;
      const distance = Math.abs(i - searchLine);
      if (distance < acc.bestDistance || (distance === acc.bestDistance && found < (acc.best?.col ?? Number.POSITIVE_INFINITY))) {
        return { best: candidate, bestDistance: distance };
      }
      return acc;
    },
    { best: null, bestDistance: Number.POSITIVE_INFINITY }
  ).best;
};

export const findContextKeyPosition = async (
  sourceFile: string,
  callLine: number,
  dangerousPath: string
): Promise<LinePosition | null> => {
  try {
    const content = await readFile(sourceFile, 'utf-8');
    const lines = content.split('\n');
    const keyName = pipe(dangerousPath, split('.'), last()) ?? '';
    const searchLine = Math.max(0, callLine - 1);
    const searchRadius = 5;

    return findBestMatch(lines, keyName, searchLine, searchRadius);
  } catch {
    return null;
  }
};