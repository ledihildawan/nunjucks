import { flatMap, pipe, reduce } from 'remeda';
import { slice, escapeRegex } from '@nunjucks/lib';
import { lineDistance, positionAtOffset, findAllOccurrences } from '@nunjucks/compiler';
import type { SourcePosition, TemplateMatch } from './error-location-types.ts';

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
  const offset = pipe(templateLines, slice(0, clampedLine), reduce((sum, l) => sum + l.length + 1, 0));
  return offset + Math.max(0, Math.min(col, templateLines[clampedLine]?.length ?? 0));
};

const isCoordinateWithinTemplate = ({
  template,
  errorLine,
  errorCol,
}: TemplateCoordinateInput): boolean => {
  const line = errorLine;
  const col = errorCol;
  if (line === null || col === null) { return false; }
  const templateLines = template.split('\n');
  if (line < 0 || line >= templateLines.length) { return false; }
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
  if (!isCoordinateWithinTemplate({ template: templateHint, errorLine: errLineno, errorCol: errColno })) {
    return null;
  }
  const match = findTemplateOccurrence({ content, templateHint, preferredLine });
  if (!match) { return null; }
  const targetOffset = match.index + templateLocationOffset({ template: match.template, errorLine: errLineno, errorCol: errColno });
  const pos = positionAtOffset(content, targetOffset);
  return { line: pos.lineOffset + 1, col: pos.col + 1 };
};

const collectRegexMatches = (content: string, re: RegExp): RegExpMatchArray[] => [...content.matchAll(re)];

type SubjectMatchMode = 'quoted' | 'bare';

const buildSubjectPatterns = (escaped: string, mode: SubjectMatchMode): Array<{ re: RegExp; group: number }> => {
  if (mode === 'quoted') {
    return [
      { re: new RegExp(`'(${escaped})'`, 'g'), group: 1 },
      { re: new RegExp(`"(${escaped})"`, 'g'), group: 1 },
    ];
  }
  return [{ re: new RegExp(`\\b(${escaped})\\b`, 'g'), group: 1 }];
};

interface SubjectOccurrenceInput {
  content: string;
  subject: string | null;
  preferredLine: number | null;
  mode?: SubjectMatchMode;
}

const findSubjectOccurrence = ({
  content,
  subject,
  preferredLine,
  mode = 'quoted',
}: SubjectOccurrenceInput): SourcePosition | null => {
  if (!subject || typeof subject !== 'string') { return null; }
  const colOffset = subjectColumnOffset(subject);
  const escaped = escapeRegex(subject);
  const patterns = buildSubjectPatterns(escaped, mode);

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

interface TemplatePatternInput {
  content: string;
  subject: string;
  preferredLine: number | null;
}

const findTemplatePattern = ({
  content,
  subject,
  preferredLine,
}: TemplatePatternInput): SourcePosition | null => {
  const pattern = `{{ ${subject} }}`;
  const match = findTemplateOccurrence({ content, templateHint: pattern, preferredLine });
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
    return findTemplatePattern({ content, subject, preferredLine });
  }
  return null;
};

interface MatchWithoutTemplateSourceInput {
  content: string;
  subject: string;
  errLineno: number | null;
  errColno: number | null;
  preferredLine: number | null;
}

const matchWithoutTemplateSource = ({
  content,
  subject,
  errLineno,
  errColno,
  preferredLine,
}: MatchWithoutTemplateSourceInput): SourcePosition | null => {
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
  return findTemplatePattern({ content, subject, preferredLine });
};

const resolveEffectiveSubject = (subject: string | null, template: string | null): string =>
  subject ?? templateLiteralText(template);

// WHY: caller-position search is split into three confidence tiers so foldCandidateSearch can try high-confidence matches (template literal) across ALL candidate files before falling back to lower-confidence ones. This prevents a reserved-word subject like 'if' from false-matching a TypeScript `if` keyword in a wrapper file when a later candidate has the actual quoted 'if' filter key.

const extractTemplatePosition = (input: CallerPositionInput): SourcePosition | null => {
  const { content, template, errLineno, errColno, subject, preferredLine } = input;
  if (typeof template === 'string') {
    return matchStringTemplate(input);
  }
  if (template === null && subject) {
    return matchWithoutTemplateSource({ content, subject, errLineno, errColno, preferredLine });
  }
  return null;
};

const extractQuotedSubjectPosition = (input: CallerPositionInput): SourcePosition | null => {
  const effectiveSubject = resolveEffectiveSubject(input.subject, input.template);
  return findSubjectOccurrence({ content: input.content, subject: effectiveSubject, preferredLine: input.preferredLine, mode: 'quoted' });
};

const extractBareSubjectPosition = (input: CallerPositionInput): SourcePosition | null => {
  const effectiveSubject = resolveEffectiveSubject(input.subject, input.template);
  return findSubjectOccurrence({ content: input.content, subject: effectiveSubject, preferredLine: input.preferredLine, mode: 'bare' });
};

export { extractTemplatePosition, extractQuotedSubjectPosition, extractBareSubjectPosition };
export type { SourcePosition };
