import { flatMap, pipe, reduce } from 'remeda';
import { slice } from '../pipe-helpers.ts';
import { escapeRegex } from '../escape-regex.ts';
import type { SourcePosition, TemplateMatch } from './error-location-types.ts';

const lineDistance = (line: number, preferredLine: number | null | undefined): number => {
  if (preferredLine === null || preferredLine === undefined) { return 0; }
  return Math.abs(line - preferredLine);
};

const templateCandidates = (templateHint: string): string[] => {
  if (!templateHint.includes('\n')) { return [templateHint]; }
  return [templateHint, templateHint.replaceAll('\n', '\r\n')];
};

const templateLiteralText = (template: unknown): string => {
  if (template === null) { return 'null'; }
  if (template === undefined) { return 'undefined'; }
  return String(template);
};

const subjectColumnOffset = (subject: string): number => {
  if (!subject.includes('.')) { return 0; }
  return subject.lastIndexOf('.') + 1;
};

const positionAtOffset = (text: string, offset: number): { lineOffset: number; col: number } => {
  const before = text.slice(0, offset);
  const parts = before.split('\n');
  return {
    lineOffset: parts.length - 1,
    col: (parts.at(-1)?.length ?? 0)
  };
};

const templateLocationOffset = (
  template: string,
  templateErrorLine: number | null,
  templateErrorCol: number | null
): number => {
  const templateLines = template.split('\n');
  const line = templateErrorLine ?? 0;
  const col = templateErrorCol ?? 0;
  const clampedLine = Math.max(0, Math.min(line, templateLines.length - 1));
  const offset = pipe(templateLines, slice(0, clampedLine), reduce((sum, l) => sum + l.length + 1, 0));
  return offset + Math.max(0, Math.min(col, templateLines[clampedLine]?.length ?? 0));
};

const isCoordinateWithinTemplate = (
  template: string,
  templateErrorLine: number | null,
  templateErrorCol: number | null
): boolean => {
  const line = templateErrorLine;
  const col = templateErrorCol;
  if (line === null || col === null) { return false; }
  const templateLines = template.split('\n');
  if (line < 0 || line >= templateLines.length) { return false; }
  const targetLine = templateLines[line] ?? '';
  return col >= 0 && col <= targetLine.length;
};

const findAllOccurrences = (content: string, candidate: string): number[] => {
  const escaped = escapeRegex(candidate);
  return [...content.matchAll(new RegExp(escaped, 'g'))].map((match) => match.index ?? 0);
};

const findTemplateOccurrence = (
  content: string,
  templateHint: string,
  preferredLine: number | null
): TemplateMatch | null => {
  const candidates = templateCandidates(templateHint);
  const allMatches = pipe(
    candidates,
    flatMap((candidate) =>
      findAllOccurrences(content, candidate).map((index) => ({
        index,
        candidate,
        line: positionAtOffset(content, index).lineOffset + 1
      }))
    ),
    reduce((best, match) => {
      const distance = lineDistance(match.line, preferredLine);
      if (distance < best.distance) {
        return { index: match.index, template: match.candidate, distance };
      }
      return best;
    }, { index: -1, template: templateHint, distance: Number.POSITIVE_INFINITY })
  );

  if (allMatches.index === -1) { return null; }
  return { index: allMatches.index, template: allMatches.template };
};

interface CaptureGroupInput {
  content: string;
  match: RegExpMatchArray;
  group: number;
  subjectColOffset: number;
}

const positionOfCaptureGroup = ({ content, match, group, subjectColOffset }: CaptureGroupInput): SourcePosition | null => {
  const groupText = match[group];
  if (!groupText) { return null; }
  const groupOffset = match[0]?.indexOf(groupText) ?? -1;
  if (groupOffset < 0) { return null; }
  const pos = positionAtOffset(content, (match.index ?? 0) + groupOffset + subjectColOffset);
  return { line: pos.lineOffset + 1, col: pos.col + 1 };
};

interface TemplateMatchInput {
  content: string;
  templateHint: string;
  errLineno: number | null;
  errColno: number | null;
  preferredLine: number | null;
}

const matchTemplateInCaller = ({ content, templateHint, errLineno, errColno, preferredLine }: TemplateMatchInput): SourcePosition | null => {
  if (!isCoordinateWithinTemplate(templateHint, errLineno, errColno)) {
    return null;
  }
  const match = findTemplateOccurrence(content, templateHint, preferredLine);
  if (!match) { return null; }
  const targetOffset = match.index + templateLocationOffset(match.template, errLineno, errColno);
  const pos = positionAtOffset(content, targetOffset);
  return { line: pos.lineOffset + 1, col: pos.col + 1 };
};

const collectRegexMatches = (content: string, re: RegExp): RegExpMatchArray[] => [...content.matchAll(re)];

const findSubjectOccurrence = (
  content: string,
  subject: string | null,
  preferredLine: number | null
): SourcePosition | null => {
  if (!subject || typeof subject !== 'string') { return null; }
  const colOffset = subjectColumnOffset(subject);
  const escaped = escapeRegex(subject);
  const patterns: Array<{ re: RegExp; group: number }> = [
    { re: new RegExp(`'(${escaped})'`, 'g'), group: 1 },
    { re: new RegExp(`"(${escaped})"`, 'g'), group: 1 },
    { re: new RegExp(`\\b(${escaped})\\b`, 'g'), group: 1 }
  ];

  return pipe(
    patterns,
    flatMap(({ re, group }) =>
      collectRegexMatches(content, re).map((match) => positionOfCaptureGroup({ content, match, group, subjectColOffset: colOffset }))
    ),
    reduce((best, hit) => {
      if (!hit) { return best; }
      const distance = lineDistance(hit.line, preferredLine);
      if (distance < best.distance) {
        return { position: hit, distance };
      }
      return best;
    }, { position: null as SourcePosition | null, distance: Number.POSITIVE_INFINITY })
  ).position;
};

const findTemplatePattern = (
  content: string,
  subject: string,
  preferredLine: number | null
): SourcePosition | null => {
  const pattern = `{{ ${subject} }}`;
  const match = findTemplateOccurrence(content, pattern, preferredLine);
  if (!match) { return null; }
  const pos = positionAtOffset(content, match.index + 3);
  return { line: pos.lineOffset + 1, col: pos.col + 1 };
};

interface CallerPositionInput {
  content: string;
  template: string | null;
  errLineno: number | null;
  errColno: number | null;
  subject: string | null;
  preferredLine: number | null;
}

const matchStringTemplate = (input: CallerPositionInput): SourcePosition | null => {
  const { content, template, errLineno, errColno, subject, preferredLine } = input;
  if (typeof template !== 'string') { return null; }
  const matched = matchTemplateInCaller({ content, templateHint: template, errLineno, errColno, preferredLine });
  if (matched) { return matched; }
  if (subject && template === 'inline') {
    return matchTemplateInCaller({ content, templateHint: `{{ ${subject} }}`, errLineno, errColno, preferredLine });
  }
  if (subject && template.trim() === `{{ ${subject} }}`) {
    return findTemplatePattern(content, subject, preferredLine);
  }
  return null;
};

const matchNullTemplate = (
  content: string,
  subject: string,
  errLineno: number | null,
  errColno: number | null,
  preferredLine: number | null
): SourcePosition | null => {
  const pattern = `{{ ${subject} }}`;
  if (errLineno !== null && errColno !== null) {
    const line = content.split('\n')[errLineno - 1];
    if (line?.includes(pattern)) {
      return { line: errLineno, col: errColno };
    }
  }
  if (preferredLine !== null) {
    const lineAtPreferred = content.split('\n')[preferredLine - 1];
    if (lineAtPreferred) {
      const idx = lineAtPreferred.indexOf(pattern);
      if (idx !== -1) {
        return { line: preferredLine, col: idx + 1 };
      }
    }
  }
  return findTemplatePattern(content, subject, preferredLine);
};

const extractCallerPosition = (input: CallerPositionInput): SourcePosition | null => {
  const { content, template, errLineno, errColno, subject, preferredLine } = input;
  if (typeof template === 'string') {
    const matched = matchStringTemplate(input);
    if (matched) { return matched; }
    if (subject) { return findSubjectOccurrence(content, subject, preferredLine); }
    return null;
  }

  if (template === null && subject) {
    const matched = matchNullTemplate(content, subject, errLineno, errColno, preferredLine);
    if (matched) { return matched; }
  }

  if (subject) {
    return findSubjectOccurrence(content, subject, preferredLine);
  }

  if (typeof template !== 'string') {
    return findSubjectOccurrence(content, templateLiteralText(template), preferredLine);
  }
  return null;
};

export { extractCallerPosition };
export type { SourcePosition };
