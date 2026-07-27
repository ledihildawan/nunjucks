import { readFile } from 'node:fs/promises';

interface LinePosition {
  line: number;
  col: number;
}

const findBestMatch = (lines: string[], keyName: string, searchLine: number, searchRadius: number): LinePosition | null => {
  let best: LinePosition | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = Math.max(0, searchLine - searchRadius); i <= Math.min(lines.length - 1, searchLine + searchRadius); i += 1) {
    const line = lines[i] ?? '';
    let col = 0;
    let found = line.indexOf(keyName, col);
    while (found !== -1) {
      const distance = Math.abs(i - searchLine);
      if (distance < bestDistance || (distance === bestDistance && found < (best?.col ?? Number.POSITIVE_INFINITY))) {
        bestDistance = distance;
        best = { line: i + 1, col: found + 1 };
      }
      col = found + 1;
      found = line.indexOf(keyName, col);
    }
  }

  return best;
};

export const findContextKeyPosition = async (
  sourceFile: string,
  callLine: number,
  dangerousPath: string
): Promise<LinePosition | null> => {
  try {
    const content = await readFile(sourceFile, 'utf-8');
    const lines = content.split('\n');
    const keyName = dangerousPath.split('.').pop() ?? '';
    const searchLine = Math.max(0, callLine - 1);
    const searchRadius = 5;

    return findBestMatch(lines, keyName, searchLine, searchRadius);
  } catch {
    return null;
  }
};