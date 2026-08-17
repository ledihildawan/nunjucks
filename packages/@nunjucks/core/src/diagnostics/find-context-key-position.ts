import { readFile } from 'node:fs/promises';
import { last, pipe, split } from 'remeda';
import { findBestMatch, type LinePosition } from './find-context-key-position-matching.ts';

interface FindContextKeyPositionInput {
  sourceFile: string;
  callLine: number;
  dangerousPath: string;
}

export const findContextKeyPosition = async ({
  sourceFile,
  callLine,
  dangerousPath,
}: FindContextKeyPositionInput): Promise<LinePosition | null> => {
  try {
    const content = await readFile(sourceFile, 'utf-8');
    const lines = content.split('\n');
    const keyName = pipe(dangerousPath, split('.'), last()) ?? '';
    const searchLine = Math.max(0, callLine - 1);
    const searchRadius = 5;

    // WHY: prefer property-key occurrences (keyName followed by ':') over bare name matches. A dangerous path like 'user.global' produces keyName 'global', which also appears inside template expressions '{{ user.global }}'. Requiring the trailing ':' ensures we point at the context definition (e.g. `{ global: process }`) rather than the template expression.
    const propKeyMatch = findBestMatch({
      lines,
      keyName: `${keyName}:`,
      searchLine,
      searchRadius,
    });
    if (propKeyMatch) {
      return propKeyMatch;
    }

    return findBestMatch({ lines, keyName, searchLine, searchRadius });
  } catch {
    // WHY: enrichment must never break the render pipeline — an unreadable source degrades to null (no position).
    return null;
  }
};
