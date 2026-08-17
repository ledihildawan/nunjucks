import { findAllOccurrences, lineDistance, positionAtOffset } from '@nunjucks/compiler';
import { slice } from '@nunjucks/lib';
import { flatMap, pipe, reduce } from 'remeda';
import type { SourcePosition, TemplateMatch } from './error-location-types.ts';

const templateCandidates = (templateHint: string): string[] => {
  if (!templateHint.includes('\n')) {
    return [templateHint];
  }
  return [templateHint, templateHint.replaceAll('\n', '\r\n')];
};

interface TemplateCoordinateInput {
  template: string;
  errorLine: number | null;
  errorCol: number | null;
}

const templateLocationOffset = ({
  template,
  errorLine,
  errorCol,
}: TemplateCoordinateInput): number => {
  const templateLines = template.split('\n');
  const line = errorLine ?? 0;
  const col = errorCol ?? 0;
  const clampedLine = Math.max(0, Math.min(line, templateLines.length - 1));
  const offset = pipe(
    templateLines,
    slice(0, clampedLine),
    reduce((sum, lineText) => sum + lineText.length + 1, 0)
  );
  return offset + Math.max(0, Math.min(col, templateLines[clampedLine]?.length ?? 0));
};

const isCoordinateWithinTemplate = ({
  template,
  errorLine,
  errorCol,
}: TemplateCoordinateInput): boolean => {
  const line = errorLine;
  const col = errorCol;
  if (line === null || col === null) {
    return false;
  }
  const templateLines = template.split('\n');
  if (line < 0 || line >= templateLines.length) {
    return false;
  }
  const targetLine = templateLines[line] ?? '';
  return col >= 0 && col <= targetLine.length;
};

interface TemplateOccurrenceInput {
  content: string;
  templateHint: string;
  preferredLine: number | null;
}

const findTemplateOccurrence = ({
  content,
  templateHint,
  preferredLine,
}: TemplateOccurrenceInput): TemplateMatch | null => {
  const candidates = templateCandidates(templateHint);
  const allMatches = pipe(
    candidates,
    flatMap((candidate) =>
      findAllOccurrences(content, candidate).map((index) => ({
        index,
        candidate,
        line: positionAtOffset(content, index).lineOffset + 1,
      }))
    ),
    reduce(
      (best, match) => {
        const distance = lineDistance(match.line, preferredLine);
        if (distance < best.distance) {
          return { index: match.index, template: match.candidate, distance };
        }
        return best;
      },
      { index: -1, template: templateHint, distance: Number.POSITIVE_INFINITY }
    )
  );

  if (allMatches.index === -1) {
    return null;
  }
  return { index: allMatches.index, template: allMatches.template };
};

interface TemplateMatchInput {
  content: string;
  templateHint: string;
  errLineno: number | null;
  errColno: number | null;
  preferredLine: number | null;
}

const matchTemplateInCaller = ({
  content,
  templateHint,
  errLineno,
  errColno,
  preferredLine,
}: TemplateMatchInput): SourcePosition | null => {
  if (
    !isCoordinateWithinTemplate({
      template: templateHint,
      errorLine: errLineno,
      errorCol: errColno,
    })
  ) {
    return null;
  }
  const match = findTemplateOccurrence({ content, templateHint, preferredLine });
  if (!match) {
    return null;
  }
  const targetOffset =
    match.index +
    templateLocationOffset({ template: match.template, errorLine: errLineno, errorCol: errColno });
  const pos = positionAtOffset(content, targetOffset);
  return { line: pos.lineOffset + 1, col: pos.col + 1 };
};

export { findTemplateOccurrence, matchTemplateInCaller };
