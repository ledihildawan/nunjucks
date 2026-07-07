import { classifyError } from '../core/classify.js';
import {
  extractLineInfo,
  extractColFromMessage,
  extractIncludeChainFromMessage,
  extractErrorTemplateName
} from '../core/extract.js';
import { mergeLine, mergeCol } from '../core/line-utils.js';
import { getSnippet, extractLineFromSnippet } from '../core/snippet-utils.js';
import { createErrorContext } from '../state/error-context.js';
import { toConsoleString } from '../formatters/console-formatter.js';
import { toHtmlString } from '../formatters/html-formatter.js';

const defaultFs = {
  readFileSync: (path, encoding) => {
    try {
      const fs = require('fs');
      return fs.readFileSync(path, encoding);
    } catch (e) {
      return null;
    }
  }
};

export class NunjucksError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = meta.errorName ?? 'NunjucksError';
    this.templateName = meta.templateName ?? 'unknown';
    this.templatePath = meta.templatePath ?? null;
    this.tplLine = meta.line ?? null;
    this.tplCol = meta.col ?? null;
    this.snippet = meta.snippet ?? null;
    this.includeChain = meta.includeChain ?? null;
    this.isProduction = meta.isProduction ?? false;
    this.originalError = meta.originalError ?? null;
  }

  getSrcLine() { return this.tplLine !== null ? this.tplLine + 1 : null; }
  getSrcCol() { return this.tplCol !== null ? this.tplCol + 1 : null; }
  get displayLine() { return this.getSrcLine() ?? '?'; }
  get displayCol() { return this.getSrcCol() ?? '?'; }

  getSrcLineFallback() { return extractLineFromSnippet(this.snippet) ?? this.getSrcLine(); }

  toConsoleString() {
    const state = {
      message: this.message,
      templateName: this.templateName,
      includeChain: this.includeChain,
      snippet: this.snippet,
      classified: classifyError(this.originalError?.message ?? ''),
      getDisplayLine: () => this.getSrcLineFallback() ?? this.displayLine,
      getDisplayCol: () => this.displayCol,
      isProduction: this.isProduction
    };
    return toConsoleString(state);
  }

  toHtmlString() {
    const state = {
      message: this.message,
      templateName: this.templateName,
      templatePath: this.templatePath,
      includeChain: this.includeChain,
      snippet: this.snippet,
      classified: classifyError(this.originalError?.message ?? ''),
      getDisplayLine: () => this.getSrcLineFallback() ?? this.displayLine,
      getDisplayCol: () => this.displayCol,
      isProduction: this.isProduction,
      originalError: this.originalError
    };
    return toHtmlString(state);
  }
}

export const createErrorFormatter = ({ fs = defaultFs, mode = 'development' } = {}) => {
  const isProd = mode === 'production';

  return {
    getMode: () => mode,
    setMode: (newMode) => { mode = newMode; },

    getSourceLines: (sourceContent) => {
      if (!sourceContent) return null;
      return sourceContent.split('\n');
    },

    async formatError(error, templateName, includeChain = null, templatePath = null) {
      const effectiveChain = includeChain ?? error._includeChain ?? null;
      const chainFromMessage = extractIncludeChainFromMessage(error.message);

      const chainForDisplay = effectiveChain
        ? (Array.isArray(effectiveChain) ? effectiveChain : [effectiveChain])
        : chainFromMessage;

      const hasIncludeChain = chainForDisplay && chainForDisplay.length > 0;
      const extractedTemplateName = hasIncludeChain ? null : extractErrorTemplateName(error.message);
      const actualTemplateName = (hasIncludeChain ? error.path : null) ?? extractedTemplateName ?? templateName;
      const actualTemplatePath = templatePath ?? error.templatePath ?? null;

      const lineFromError = error.lineno;
      const colFromError = error.colno;
      const { line: lineFromMsg, col: colFromMsg } = extractLineInfo(error.message);
      const colFromRawMsg = extractColFromMessage(error.message);

      const line = mergeLine(lineFromError, lineFromMsg);
      const col = mergeCol(colFromError, colFromMsg, colFromRawMsg);

      let snippet = null;

      let sourceContent = null;
      if (templatePath) {
        try {
          sourceContent = fs.readFileSync(templatePath, 'utf-8');
        } catch (e) {
          sourceContent = null;
        }
      }

      if (sourceContent) {
        const sourceLines = this.getSourceLines(sourceContent);
        if (line !== null) {
          const ctx = createErrorContext({ line, col });
          snippet = getSnippet(sourceLines, ctx.getSrcLine(), 3);
        }
      } else if (line !== null) {
        snippet = `>>> ${line + 1}: [source not available]`;
      }

      const classified = classifyError(error.originalError?.message ?? error.message);

      const meta = {
        templateName: actualTemplateName,
        templatePath: actualTemplatePath,
        line,
        col,
        snippet,
        includeChain: chainForDisplay,
        isProduction: isProd,
        errorName: error.name,
        originalError: error
      };

      return new NunjucksError(error.message, meta);
    }
  };
}

export const ErrorFormatter = createErrorFormatter;
