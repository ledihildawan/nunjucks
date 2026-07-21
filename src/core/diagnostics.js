import { readFileSync } from 'node:fs';
import { createLog, normalizeErrorMetadata } from '@nunjucks/log';

const positionAtOffset = (text, offset) => {
  const before = text.slice(0, offset);
  const parts = before.split('\n');
  return {
    lineOffset: parts.length - 1,
    col: parts[parts.length - 1].length + 1
  };
};

const templateLocationOffset = (template, templateErrorLine, templateErrorCol) => {
  const templateLines = template.split('\n');
  const line = Number.isInteger(templateErrorLine) ? templateErrorLine : 0;
  const col = Number.isInteger(templateErrorCol) ? templateErrorCol : 0;
  const clampedLine = Math.max(0, Math.min(line, templateLines.length - 1));
  let offset = 0;

  for (let i = 0; i < clampedLine; i++) {
    offset += templateLines[i].length + 1;
  }

  return offset + Math.max(0, Math.min(col, templateLines[clampedLine].length));
};

const findTemplateOccurrence = (content, templateHint, preferredLine) => {
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
      const distance = preferredLine ? Math.abs(line - preferredLine) : 0;
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

export const findContextKeyPosition = (sourceFile, callLine, dangerousPath) => {
  try {
    const content = readFileSync(sourceFile, 'utf-8');
    const lines = content.split('\n');
    const keyName = dangerousPath.split('.').pop();
    const searchLine = Math.max(0, callLine - 1);
    const searchRadius = 5;

    let best = null;
    let bestDistance = Infinity;

    for (let i = Math.max(0, searchLine - searchRadius); i <= Math.min(lines.length - 1, searchLine + searchRadius); i++) {
      const line = lines[i];
      let col = 0;
      while ((col = line.indexOf(keyName, col)) !== -1) {
        const distance = Math.abs(i - searchLine);
        if (distance < bestDistance || (distance === bestDistance && col < (best?.col ?? Infinity))) {
          bestDistance = distance;
          best = { line: i + 1, col: col + 1 };
        }
        col++;
      }
    }

    if (best) {
      return best;
    }
  } catch {
    // File read error, ignore
  }

  return null;
};

const findSubjectOccurrence = (content, subject, preferredLine) => {
  if (!subject || typeof subject !== 'string') return null;

  let best = null;
  let bestDistance = Infinity;
  const subjectColOffset = subject.includes('.') ? subject.lastIndexOf('.') + 1 : 0;
  const escaped = subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    { re: new RegExp(`'(${escaped})'`, 'g'), group: 1 },
    { re: new RegExp(`"(${escaped})"`, 'g'), group: 1 },
    { re: new RegExp(`\\b(${escaped})\\b`, 'g'), group: 1 }
  ];

  for (const { re, group } of patterns) {
    let match;
    while ((match = re.exec(content)) !== null) {
      const groupText = match[group];
      if (!groupText) continue;

      const groupOffset = match[0].indexOf(groupText);
      const offset = match.index + groupOffset + subjectColOffset;
      const position = positionAtOffset(content, offset);
      const line = position.lineOffset + 1;
      const distance = preferredLine ? Math.abs(line - preferredLine) : 0;
      if (distance < bestDistance) {
        best = { line, col: position.col };
        bestDistance = distance;
      }
    }
  }

  return best;
};

const matchTemplateInContent = (content, templateHint, templateErrorLine, templateErrorCol, preferredLine) => {
  const templateMatch = findTemplateOccurrence(content, templateHint, preferredLine);
  if (!templateMatch) return null;
  const targetOffset = templateMatch.index + templateLocationOffset(templateMatch.template, templateErrorLine, templateErrorCol);
  const position = positionAtOffset(content, targetOffset);
  return { line: position.lineOffset + 1, col: position.col };
};

const resolveInlineCoordinates = (content, errorLine, errorCol, templateHint, templateErrorLine, templateErrorCol, subjectHint, resolveInlineLocation) => {
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

const extractCodeContext = (filePath, errorLine, errorCol, templateHint = null, templateErrorLine = null, templateErrorCol = null, subjectHint = null, resolveInlineLocation = true) => {
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    const { resolvedLine, resolvedCol } = resolveInlineCoordinates(content, errorLine, errorCol, templateHint, templateErrorLine, templateErrorCol, subjectHint, resolveInlineLocation);

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

const resolveErrorLocation = (config, initialMetadata, errLineno, errColno, template) => {
  const useJsCaller = config.jsCallerErrorLine != null;
  const hasErrorLocation = errLineno !== undefined && errLineno !== null;
  const preferJsCallerLocation = !config.templatePath && useJsCaller;
  const templatePath = preferJsCallerLocation
    ? (config.jsCaller || config._callerFile || initialMetadata.templateName || null)
    : (config.templatePath || initialMetadata.templatePath || initialMetadata.templateName || config._callerFile || null);

  let sourceContent = template;
  let sourceStartLine = 1;
  let resolvedJsCallerLine = config.jsCallerErrorLine ?? null;
  let resolvedJsCallerCol = config.jsCallerErrorCol ?? null;

  const hasCallerLocation = hasErrorLocation && initialMetadata.lineBase === 'one';

  if (preferJsCallerLocation && useJsCaller && config.jsCaller) {
    const codeContext = extractCodeContext(
      config.jsCaller,
      hasCallerLocation ? errLineno : config.jsCallerErrorLine,
      hasCallerLocation ? errColno : config.jsCallerErrorCol,
      template,
      errLineno,
      errColno,
      initialMetadata.subject,
      !hasCallerLocation
    );
    if (codeContext) {
      sourceContent = codeContext.content;
      sourceStartLine = codeContext.startLine;
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

export const wrapWithLog = (err, config, template = null, renderContext = null) => {
  const initialMetadata = normalizeErrorMetadata(err, {
    phase: config.phase || 'render',
    templatePath: config.templatePath || config._callerFile || null,
    sourceContent: typeof template === 'string' ? template : null,
    renderContext
  });
  const errLineno = initialMetadata.lineno;
  const errColno = initialMetadata.colno;
  const phase = initialMetadata.phase || config.phase || 'render';
  const dev = config.dev ?? false;
  const ide = config.ide ?? 'vscode';
  const timestamp = new Date().toISOString();

  const { lineno, colno, lineBase, templatePath, sourceContent, sourceStartLine, preferJsCallerLocation } =
    resolveErrorLocation(config, initialMetadata, errLineno, errColno, template);

  const metadata = normalizeErrorMetadata(err, {
    lineno,
    colno,
    phase,
    templateName: templatePath,
    templatePath,
    sourceContent,
    sourceStartLine,
    renderContext,
    code: 'RENDER_ERROR'
  });
  metadata.lineno = lineno;
  metadata.colno = colno;
  metadata.lineBase = lineBase;
  metadata.templateName = templatePath;
  metadata.templatePath = templatePath;
  metadata.sourceContent = sourceContent;
  metadata.sourceStartLine = sourceStartLine;
  metadata.renderContext = renderContext;

  const originalCauses = err.causes;
  const originalFixCode = err.fixCode;
  const originalFixComment = err.fixComment;
  const originalSuggestion = err.suggestion;
  const originalDocumentationUrl = err.documentationUrl;
  const originalRelatedLinks = err.relatedLinks;
  const originalSeverity = err.severity;

  const errorDef = {
    name: metadata.code || 'RENDER_ERROR',
    message: () => metadata.message,
    pattern: /./,
    causes: Array.isArray(originalCauses) && originalCauses.length > 0 ? originalCauses : undefined,
    fixCode: typeof originalFixCode === 'string' ? originalFixCode : undefined,
    fixComment: typeof originalFixComment === 'string' ? originalFixComment : undefined,
    suggestion: typeof originalSuggestion === 'string' ? originalSuggestion : undefined,
    documentationUrl: typeof originalDocumentationUrl === 'string' ? originalDocumentationUrl : undefined,
    relatedLinks: Array.isArray(originalRelatedLinks) ? originalRelatedLinks : undefined,
    severity: originalSeverity || 'error',
  };
  const errorObj = createLog('error', errorDef, {}, metadata.subject, {
    lineno: metadata.lineno,
    colno: metadata.colno,
    phase: metadata.phase,
    templateName: metadata.templateName,
    code: metadata.code,
    lineBase: metadata.lineBase,
    dev,
    ide,
    templatePath,
    sourceContent,
    sourceStartLine,
    renderContext,
    timestamp,
    verbosity: 'full',
    isJsCaller: preferJsCallerLocation,
  });
  errorObj.templatePath = templatePath;
  errorObj.sourceStartLine = sourceStartLine;
  errorObj.renderContext = metadata.renderContext;

  return errorObj;
};
