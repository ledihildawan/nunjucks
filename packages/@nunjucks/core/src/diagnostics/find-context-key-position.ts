import { last, pipe, split } from 'remeda';
import { findBestMatch, type LinePosition } from './find-context-key-position-matching.ts';
import { readSourceContent } from './shell/read-source-content.ts';

interface FindContextKeyPositionInput {
  sourceFile: string;
  callLine: number;
  dangerousPath: string;
}

/**
 * Locates the line/col where a dangerous context key is defined in the caller's
 * source — reads the file off disk, preferring property-key occurrences
 * (`key:`) near the render call, degrading to `null` when unreadable.
 */
export const findContextKeyPosition = async ({
  sourceFile,
  callLine,
  dangerousPath,
}: FindContextKeyPositionInput): Promise<LinePosition | null> => {
  const content = await readSourceContent(sourceFile);
  if (content === null) {
    // WHY: enrichment must never break the render pipeline — an unreadable source degrades to null (no position).
    return null;
  }
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
};
