import { readFileSync } from 'node:fs';
import { createLog, type TemplateError } from '@nunjucks/log';
import { normalizeErrorMetadata, type NormalizedErrorMetadata } from '@nunjucks/log';

interface Position {
  lineOffset: number;
  col: number;
}

interface LinePosition {
  line: number;
  col: number;
}

interface SourcePosition {
  line: number;
  col: number;
  name: string | null;
}

interface TemplateMatch {
  index: number;
  template: string;
}

interface CodeContext {
  content: string;
  startLine: number;
  errorCol: number;
  errorLine: number;
}

interface ResolveLocationResult {
  lineno: number | null;
  colno: number | null;
  lineBase: 'zero' | 'one';
  templatePath: string | null;
  sourceContent: string | null;
  sourceStartLine: number;
  preferJsCallerLocation: boolean;
}

interface DiagnosticsConfig {
  phase?: string | null;
  templatePath?: string | null;
  jsCaller?: string | null;
  jsCallerErrorLine?: number | null;
  jsCallerErrorCol?: number | null;
  _callerFile?: string | null;
  dev?: boolean;
  ide?: string;
  lineno?: number | null;
  colno?: number | null;
}

const positionAtOffset = (text: string, offset: number): Position => {
  const before = text.slice(0, offset);
  const parts = before.split('\n');
  return {
    lineOffset: parts.length - 1,
    col: (parts.at(-1)?.length ?? 0) + 1
  };
};

const templateLocationOffset = (template: string, templateErrorLine: number | null, templateErrorCol: number | null): number => {
  const templateLines = template.split('\n');
  const line = templateErrorLine ?? 0;
  const col = templateErrorCol ?? 0;
  const clampedLine = Math.max(0, Math.min(line, templateLines.length - 1));
  let offset = 0;

  for (let i = 0; i < clampedLine; i++) {
    offset += (templateLines[i]?.length ?? 0) + 1;
  }

  return offset + Math.max(0, Math.min(col, templateLines[clampedLine]?.length ?? 0));
};

const findTemplateOccurrence = (content: string, templateHint: string, preferredLine: number | null): TemplateMatch | null => {
  let best = -1;
  let bestTemplate = templateHint;
  let bestDistance = Infinity;
  const candidates = templateHint.includes('\n')
    ? [templateHint, templateHint.replace(/\n/g, '\r\n')]
    : [templateHint];

  for (const candidate of candidates) {
    let searchFrom = 0;

    while (true) {
      const found = content.indexOf(candidate, searchFrom);
      if (found === -1) break;

      const position = positionAtOffset(content, found);
      const line = position.lineOffset + 1;
      const distance = preferredLine != null ? Math.abs(line - preferredLine) : 0;
      if (distance < bestDistance) {
        best = found;
        bestTemplate = candidate;
        bestDistance = distance;
      }

      searchFrom = found + 1;
    }
  }

  return best === -1 ? null : { index: best, template: bestTemplate };
};

export const findContextKeyPosition = (sourceFile: string, callLine: number, dangerousPath: string): LinePosition | null => {
  try {
    const content = readFileSync(sourceFile, 'utf-8');
    const lines = content.split('\n');
    const keyName = dangerousPath.split('.').pop() ?? '';
    const searchLine = Math.max(0, callLine - 1);
    const searchRadius = 5;

    let best: LinePosition | null = null;
    let bestDistance = Infinity;

    for (let i = Math.max(0, searchLine - searchRadius); i <= Math.min(lines.length - 1, searchLine + searchRadius); i++) {
      const line = lines[i] ?? '';
      let col = 0;
      let found = line.indexOf(keyName, col);
      while (found !== -1) {
        const distance = Math.abs(i - searchLine);
        if (distance < bestDistance || (distance === bestDistance && found < (best?.col ?? Infinity))) {
          bestDistance = distance;
          best = { line: i + 1, col: found + 1 };
        }
        col = found + 1;
        found = line.indexOf(keyName, col);
      }
    }

    if (best) {
      return best;
    }
  } catch {
    // Ignore file read errors - fall through to return null
  }

  return null;
};

const findSubjectOccurrence = (content: string, subject: string | null, preferredLine: number | null): LinePosition | null => {
  if (!subject || typeof subject !== 'string') return null;

  let best: LinePosition | null = null;
  let bestDistance = Infinity;
  const subjectColOffset = subject.includes('.') ? subject.lastIndexOf('.') + 1 : 0;
  const escaped = subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns: Array<{ re: RegExp; group: number }> = [
    { re: new RegExp(`'(${escaped})'`, 'g'), group: 1 },
    { re: new RegExp(`"(${escaped})"`, 'g'), group: 1 },
    { re: new RegExp(`\\b(${escaped})\\b`, 'g'), group: 1 }
  ];

  for (const { re, group } of patterns) {
    let match: RegExpExecArray | null;
    while (true) {
      match = re.exec(content);
      if (match === null) break;
      const groupText = match[group];
      if (!groupText) continue;

      const groupOffset = match[0].indexOf(groupText);
      const offset = match.index + groupOffset + subjectColOffset;
      const position = positionAtOffset(content, offset);
      const line = position.lineOffset + 1;
      const distance = preferredLine != null ? Math.abs(line - preferredLine) : 0;
      if (distance < bestDistance) {
        best = { line, col: position.col };
        bestDistance = distance;
      }
    }
  }

  return best;
};

const matchTemplateInContent = (content: string, templateHint: string, templateErrorLine: number | null, templateErrorCol: number | null, preferredLine: number | null): SourcePosition | null => {
  const templateMatch = findTemplateOccurrence(content, templateHint, preferredLine);
  if (!templateMatch) return null;
  const targetOffset = templateMatch.index + templateLocationOffset(templateMatch.template, templateErrorLine, templateErrorCol);
  const position = positionAtOffset(content, targetOffset);
  return { line: position.lineOffset + 1, col: position.col, name: null };
};

const resolveInlineCoordinates = (
  content: string,
  errorLine: number,
  errorCol: number,
  templateHint: string | null,
  templateErrorLine: number | null,
  templateErrorCol: number | null,
  subjectHint: string | null,
  resolveInlineLocation: boolean
): { resolvedLine: number; resolvedCol: number } => {
  let resolvedLine = errorLine;
  let resolvedCol = errorCol;

  if (resolveInlineLocation) {
    let templateMatched = false;
    if (typeof templateHint === 'string' && Number.isInteger(templateErrorLine) && Number.isInteger(templateErrorCol)) {
      const match = matchTemplateInContent(content, templateHint, templateErrorLine, templateErrorCol, errorLine);
      if (match) {
        templateMatched = true;
        resolvedLine = match.line;
        resolvedCol = match.col;
      }
    }

    if (!templateMatched) {
      const subjectMatch = findSubjectOccurrence(content, subjectHint, errorLine);
      if (subjectMatch) {
        resolvedLine = subjectMatch.line;
        resolvedCol = subjectMatch.col;
      } else if (templateHint === null || templateHint === undefined) {
        const nullMatch = findSubjectOccurrence(content, 'null', errorLine);
        if (nullMatch) {
          resolvedLine = nullMatch.line;
          resolvedCol = nullMatch.col;
        }
      } else if (typeof templateHint === 'string') {
        const match = matchTemplateInContent(content, templateHint, templateErrorLine, templateErrorCol, errorLine);
        if (match) {
          resolvedLine = match.line;
          resolvedCol = match.col;
        }
      } else {
        const templateValueMatch = findSubjectOccurrence(content, String(templateHint), errorLine);
        if (templateValueMatch) {
          resolvedLine = templateValueMatch.line;
          resolvedCol = templateValueMatch.col;
        }
      }
    }
  } else if (templateHint !== null && templateHint !== undefined && typeof templateHint !== 'string') {
    const templateValueMatch = findSubjectOccurrence(content, String(templateHint), errorLine);
    if (templateValueMatch) {
      resolvedLine = templateValueMatch.line;
      resolvedCol = templateValueMatch.col;
    }
  }

  return { resolvedLine, resolvedCol };
};

const extractCodeContext = (
  filePath: string,
  errorLine: number,
  errorCol: number,
  templateHint?: string | null,
  templateErrorLine?: number | null,
  templateErrorCol?: number | null,
  subjectHint?: string | null,
  resolveInlineLocation = true
): CodeContext | null => {
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    const { resolvedLine, resolvedCol } = resolveInlineCoordinates(
      content,
      errorLine,
      errorCol,
      templateHint ?? null,
      templateErrorLine ?? null,
      templateErrorCol ?? null,
      subjectHint ?? null,
      resolveInlineLocation
    );

    if (resolvedLine < 1 || resolvedLine > lines.length) {
      return null;
    }

    const windowSize = 10;
    const startLine = Math.max(1, resolvedLine - windowSize);
    const endLine = Math.min(lines.length, resolvedLine + windowSize);

    return {
      content: lines.slice(startLine - 1, endLine).join('\n'),
      startLine,
      errorCol: resolvedCol,
      errorLine: resolvedLine
    };
  } catch {
    return null;
  }
};

const resolveErrorLocation = (config: DiagnosticsConfig, initialMetadata: NormalizedErrorMetadata, errLineno: number | null, errColno: number | null, template: string | null): ResolveLocationResult => {
  const useJsCaller = config.jsCallerErrorLine != null;
  const hasErrorLocation = errLineno !== undefined && errLineno !== null;
  const preferJsCallerLocation = !config.templatePath && useJsCaller;
  const templatePath = preferJsCallerLocation
    ? (config.jsCaller || config._callerFile || initialMetadata.templateName || null)
    : (config.templatePath || initialMetadata.templatePath || initialMetadata.templateName || config._callerFile || null);

  let sourceContent = template;
  let sourceStartLine = 1;
  let resolvedJsCallerLine: number | null = config.jsCallerErrorLine ?? null;
  let resolvedJsCallerCol: number | null = config.jsCallerErrorCol ?? null;

  const hasCallerLocation = hasErrorLocation && initialMetadata.lineBase === 'one';

  if (preferJsCallerLocation && useJsCaller && config.jsCaller) {
    const codeContext = extractCodeContext(
      config.jsCaller,
      hasCallerLocation ? (errLineno as number) : (config.jsCallerErrorLine as number),
      hasCallerLocation ? (errColno as number) : (config.jsCallerErrorCol as number),
      template,
      errLineno,
      errColno,
      initialMetadata.subject,
      !hasCallerLocation
    );
    if (codeContext) {
      try {
        sourceContent = readFileSync(config.jsCaller, 'utf8');
        sourceStartLine = 1;
      } catch {
        sourceContent = codeContext.content;
        sourceStartLine = codeContext.startLine;
      }
      resolvedJsCallerLine = codeContext.errorLine ?? resolvedJsCallerLine;
      resolvedJsCallerCol = codeContext.errorCol ?? resolvedJsCallerCol;
    }
  }

  const lineno = preferJsCallerLocation
    ? (resolvedJsCallerLine ?? config.lineno ?? errLineno ?? null)
    : (hasErrorLocation && errLineno != null ? errLineno : (resolvedJsCallerLine ?? config.lineno ?? null));
  const colno = preferJsCallerLocation
    ? (resolvedJsCallerCol ?? config.colno ?? errColno ?? null)
    : (hasErrorLocation && errColno != null ? errColno : (resolvedJsCallerCol ?? config.colno ?? null));
  const lineBase = preferJsCallerLocation
    ? 'one'
    : (hasErrorLocation ? initialMetadata.lineBase : (!hasErrorLocation && useJsCaller ? 'one' : initialMetadata.lineBase));

  return { lineno, colno, lineBase, templatePath, sourceContent, sourceStartLine, preferJsCallerLocation };
};

interface ErrorWithCauses extends Error {
  causes?: string[];
  fixCode?: string;
  fixComment?: string;
  suggestion?: string;
  documentationUrl?: string;
  severity?: 'error' | 'warning' | 'info';
}

export const wrapWithLog = (err: unknown, config: DiagnosticsConfig, template: string | null = null, renderContext: unknown = null): TemplateError => {
  const initialMetadata = normalizeErrorMetadata(err, {
    phase: config.phase || 'render',
    templatePath: config.templatePath || config._callerFile || null,
    sourceContent: typeof template === 'string' ? template : null,
    renderContext: renderContext as Record<string, unknown> | null
  });
  const errLineno = initialMetadata.lineno;
  const errColno = initialMetadata.colno;
  const phase = initialMetadata.phase || config.phase || 'render';
  const dev = config.dev ?? false;
  const ide = config.ide ?? 'vscode';
  const timestamp = new Date().toISOString();

  const { lineno, colno, lineBase, templatePath, sourceContent, sourceStartLine, preferJsCallerLocation } =
    resolveErrorLocation(config, initialMetadata, errLineno, errColno, template);

  delete (err as Record<string, unknown>).lineBase;
  delete (err as Record<string, unknown>).lineno;
  delete (err as Record<string, unknown>).colno;
  const metadata = normalizeErrorMetadata(err, {
    lineno,
    colno,
    lineBase,
    phase,
    templateName: templatePath,
    templatePath,
    sourceContent,
    sourceStartLine,
    renderContext: renderContext as Record<string, unknown> | null,
    code: 'RENDER_ERROR'
  });

  const errExt = err as ErrorWithCauses;
  const originalCauses = errExt.causes;
  const originalFixCode = errExt.fixCode;
  const originalFixComment = errExt.fixComment;
  const originalSuggestion = errExt.suggestion;
  const originalDocumentationUrl = errExt.documentationUrl;
  const originalSeverity = errExt.severity;

  const errorDef = {
    name: metadata.code || 'RENDER_ERROR',
    message: () => metadata.message,
    pattern: /./,
    causes: Array.isArray(originalCauses) && originalCauses.length > 0 ? originalCauses : undefined,
    fixCode: typeof originalFixCode === 'string' ? originalFixCode : undefined,
    fixComment: typeof originalFixComment === 'string' ? originalFixComment : undefined,
    suggestion: typeof originalSuggestion === 'string' ? originalSuggestion : undefined,
    documentationUrl: typeof originalDocumentationUrl === 'string' ? originalDocumentationUrl : undefined,
    severity: originalSeverity || 'error',
  };

  const contextObj: Record<string, unknown> = {
    lineno: metadata.lineno,
    colno: metadata.colno,
    phase: metadata.phase,
    templateName: metadata.templateName,
    lineBase: metadata.lineBase,
    dev,
    ide,
    templatePath: templatePath ?? undefined,
    sourceContent: sourceContent ?? undefined,
    sourceStartLine,
    renderContext: renderContext as Record<string, unknown> | undefined,
    timestamp,
    verbosity: 'full',
    isJsCaller: preferJsCallerLocation,
  };

  const errorObj = createLog('error', errorDef, {}, metadata.subject, contextObj as Parameters<typeof createLog>[4]) as TemplateError;
  errorObj.templatePath = templatePath;
  errorObj.sourceStartLine = sourceStartLine;
  errorObj.renderContext = metadata.renderContext ?? undefined;

  return errorObj;
};
