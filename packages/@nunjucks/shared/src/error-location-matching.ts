import type { SourcePosition, TemplateMatch } from './error-location-types.ts';

const TRAILING_WHITESPACE_RE = /\s+$/gu;

const lineDistance = (line: number, preferredLine: number | null | undefined): number => {
  if (preferredLine === null || preferredLine === undefined) { return 0; }
  return Math.abs(line - preferredLine);
};

const templateCandidates = (templateHint: string): string[] => {
  if (!templateHint.includes('\n')) { return [templateHint]; }
  return [templateHint, templateHint.replace(/\n/g, '\r\n')];
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
  let offset = 0;
  for (let i = 0; i < clampedLine; i += 1) {
    offset += (templateLines[i]?.length ?? 0) + 1;
  }
  return offset + Math.max(0, Math.min(col, templateLines[clampedLine]?.length ?? 0));
};

const isCoordinateWithinTemplate = (
  template: string,
  templateErrorLine: number | null,
  templateErrorCol: number | null
): boolean => {
  if (!(Number.isInteger(templateErrorLine) && Number.isInteger(templateErrorCol))) {
    return false;
  }
  const templateLines = template.split('\n');
  const line = templateErrorLine as number;
  const col = templateErrorCol as number;
  if (line < 0 || line >= templateLines.length) {
    return false;
  }
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

const templateEndPosition = (template: string): SourcePosition => {
  const trimmed = template.replace(TRAILING_WHITESPACE_RE, '');
  const lines = trimmed.split('\n');
  const line = Math.max(0, lines.length - 1);
  const lastLine = lines[line] ?? '';
  const col = Math.max(0, lastLine.length - 1);
  return { line, col };
};

const tryMatchTemplate = (
  content: string,
  template: string,
  errLineno: number | null,
  errColno: number | null,
  preferredLine: number | null
): SourcePosition | null => {
  return matchTemplateInCaller(content, template, errLineno, errColno, preferredLine);
};

const tryMatchSubject = (
  content: string,
  subject: string,
  preferredLine: number | null
): SourcePosition | null => {
  return findSubjectOccurrence(content, subject, preferredLine);
};

const tryMatchTemplateEnd = (
  content: string,
  template: string,
  errLineno: number | null,
  errColno: number | null,
  preferredLine: number | null
): SourcePosition | null => {
  if (template.length > 0 && !isCoordinateWithinTemplate(template, errLineno, errColno)) {
    return null;
  }
  return matchTemplateInCaller(content, template, errLineno, errColno, preferredLine);
};

const tryMatchNonStringTemplate = (
  content: string,
  template: unknown,
  preferredLine: number | null
): SourcePosition | null => {
  const literal = templateLiteralText(template);
  return findSubjectOccurrence(content, literal, preferredLine);
};

const tryExtractWithMatcher = <T>(matcher: () => T | null): T | null => matcher();

const extractCallerPosition = (
  content: string,
  template: string | null,
  errLineno: number | null,
  errColno: number | null,
  subject: string | null,
  preferredLine: number | null
): SourcePosition | null => {
  if (typeof template === 'string') {
    const matched = tryExtractWithMatcher(
      () => tryMatchTemplate(content, template, errLineno, errColno, preferredLine)
    );
    if (matched) { return matched; }

    const templateEndMatched = tryExtractWithMatcher(
      () => tryMatchTemplateEnd(content, template, errLineno, errColno, preferredLine)
    );
    if (templateEndMatched) { return templateEndMatched; }

    if (subject) {
      return tryExtractWithMatcher(
        () => tryMatchSubject(content, subject, preferredLine)
      );
    }
    return null;
  }

  if (subject) {
    return tryExtractWithMatcher(
      () => tryMatchSubject(content, subject, preferredLine)
    );
  }

  if (typeof template !== 'string') {
    return tryExtractWithMatcher(
      () => tryMatchNonStringTemplate(content, template, preferredLine)
    );
  }
  return null;
};

export { extractCallerPosition };
export type { SourcePosition };
