import { escapeRegex } from '@nunjucks/lib';

export const lineDistance = (line: number, preferredLine: number | null | undefined): number => {
  if (preferredLine === null || preferredLine === undefined) {
    return 0;
  }
  return Math.abs(line - preferredLine);
};

export const positionAtOffset = (
  text: string,
  offset: number
): { lineOffset: number; col: number } => {
  const before = text.slice(0, offset);
  const parts = before.split('\n');
  return {
    lineOffset: parts.length - 1,
    col: parts.at(-1)?.length ?? 0,
  };
};

export const findAllOccurrences = (content: string, candidate: string): number[] => {
  const escaped = escapeRegex(candidate);
  return [...content.matchAll(new RegExp(escaped, 'g'))].map((match) => match.index ?? 0);
};
