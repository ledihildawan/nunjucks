import { pipe, reduce } from 'remeda';
import { slice } from '../pipe-helpers.ts';
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

const findTemplateOccurrence = (
  content: string,
  templateHint: string,
  preferredLine: number | null
): TemplateMatch | null => {
  let best = -1;
  let bestTemplate = templateHint;
  let bestDistance = Number.POSITIVE_INFINITY;
  const candidates = templateCandidates(templateHint);

  for (const candidate of candidates) {
    let searchFrom = 0;
    for (;;) {
      const found = content.indexOf(candidate, searchFrom);
      if (found === -1) { break; }
      const line = positionAtOffset(content, found).lineOffset + 1;
      const distance = lineDistance(line, preferredLine);
      if (distance < bestDistance) {
        best = found;
        bestTemplate = candidate;
        bestDistance = distance;
      }
      searchFrom = found + 1;
    }
  }

  if (best === -1) { return null; }
  return { index: best, template: bestTemplate };
};

const positionOfCaptureGroup = (
  content: string,
  match: RegExpExecArray,
  group: number,
  subjectColOffset: number
): SourcePosition | null => {
  const groupText = match[group];
  if (!groupText) { return null; }
  const groupOffset = match[0].indexOf(groupText);
  if (groupOffset < 0) { return null; }
  const pos = positionAtOffset(content, match.index + groupOffset + subjectColOffset);
  return { line: pos.lineOffset + 1, col: pos.col + 1 };
};

const matchTemplateInCaller = (
  content: string,
  templateHint: string,
  templateErrorLine: number | null,
  templateErrorCol: number | null,
  preferredLine: number | null
): SourcePosition | null => {
  if (!isCoordinateWithinTemplate(templateHint, templateErrorLine, templateErrorCol)) {
    return null;
  }
  const match = findTemplateOccurrence(content, templateHint, preferredLine);
  if (!match) { return null; }
  const targetOffset = match.index + templateLocationOffset(match.template, templateErrorLine, templateErrorCol);
  const pos = positionAtOffset(content, targetOffset);
  return { line: pos.lineOffset + 1, col: pos.col + 1 };
};

const findSubjectOccurrence = (
  content: string,
  subject: string | null,
  preferredLine: number | null
): SourcePosition | null => {
  if (!subject || typeof subject !== 'string') { return null; }
  const colOffset = subjectColumnOffset(subject);
  const escaped = subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns: Array<{ re: RegExp; group: number }> = [
    { re: new RegExp(`'(${escaped})'`, 'g'), group: 1 },
    { re: new RegExp(`"(${escaped})"`, 'g'), group: 1 },
    { re: new RegExp(`\\b(${escaped})\\b`, 'g'), group: 1 }
  ];

  let best: SourcePosition | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  const evaluateMatch = (match: RegExpExecArray, group: number): void => {
    const hit = positionOfCaptureGroup(content, match, group, colOffset);
    if (hit) {
      const distance = lineDistance(hit.line, preferredLine);
      if (distance < bestDistance) {
        best = hit;
        bestDistance = distance;
      }
    }
  };

  for (const { re, group } of patterns) {
    for (let match = re.exec(content); match !== null; match = re.exec(content)) {
      evaluateMatch(match, group);
    }
  }
  return best;
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

const matchStringTemplate = (
  content: string,
  template: string,
  errLineno: number | null,
  errColno: number | null,
  subject: string | null,
  preferredLine: number | null
): SourcePosition | null => {
  const matched = matchTemplateInCaller(content, template, errLineno, errColno, preferredLine);
  if (matched) { return matched; }
  if (subject && template === 'inline') {
    return matchTemplateInCaller(content, `{{ ${subject} }}`, errLineno, errColno, preferredLine);
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

const extractCallerPosition = (
  content: string,
  template: string | null,
  errLineno: number | null,
  errColno: number | null,
  subject: string | null,
  preferredLine: number | null
): SourcePosition | null => {
  if (typeof template === 'string') {
    const matched = matchStringTemplate(content, template, errLineno, errColno, subject, preferredLine);
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
