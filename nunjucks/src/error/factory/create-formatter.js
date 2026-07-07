import { classifyError } from '../core/classify.js';
import {
  extractLineInfo,
  extractColFromMessage,
  extractIncludeChainFromMessage,
  extractErrorTemplateName
} from '../core/extract.js';
import { mergeLine, mergeCol, getDisplayLine, getDisplayCol } from '../core/line-utils.js';
import { getSnippet, extractLineFromSnippet } from '../core/snippet-utils.js';
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

export const createNunjucksError = (message, meta = {}) => {
  const tplLine = meta.line ?? null;
  const tplCol = meta.col ?? null;
  const snippet = meta.snippet ?? null;
  const includeChain = meta.includeChain ?? null;
  const isProduction = meta.isProduction ?? false;
  const originalError = meta.originalError ?? null;
  const classified = classifyError(originalError?.message ?? '');

  const err = {
    name: meta.errorName ?? 'NunjucksError',
    message,
    templateName: meta.templateName ?? 'unknown',
    templatePath: meta.templatePath ?? null,
    originalError,
    classified,

    getSrcLine: () => getDisplayLine(tplLine),
    getSrcCol: () => getDisplayCol(tplCol),
    getDisplayLine: () => getDisplayLine(tplLine) ?? '?',
    getDisplayCol: () => getDisplayCol(tplCol) ?? '?',

    getSrcLineFallback: () => extractLineFromSnippet(snippet) ?? getDisplayLine(tplLine),
    getDisplayLineFallback: () => extractLineFromSnippet(snippet) ?? getDisplayLine(tplLine) ?? '?',

    get snippet() { return snippet; },
    get includeChain() { return includeChain; },
    get isProduction() { return isProduction; },

    toConsoleString: () => {
      const state = {
        message,
        templateName: meta.templateName ?? 'unknown',
        includeChain,
        snippet,
        classified,
        getDisplayLine: () => err.getDisplayLineFallback(),
        getDisplayCol: () => err.getDisplayCol(),
        isProduction,
        originalError
      };
      return toConsoleString(state);
    },

    toHtmlString: () => {
      const state = {
        message,
        templateName: meta.templateName ?? 'unknown',
        templatePath: meta.templatePath ?? null,
        includeChain,
        snippet,
        classified,
        getDisplayLine: () => err.getDisplayLineFallback(),
        getDisplayCol: () => err.getDisplayCol(),
        isProduction,
        originalError
      };
      return toHtmlString(state);
    }
  };

  return err;
};

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

      const lineFromError = error.lineno != null ? error.lineno + 1 : null;
      const colFromError = error.colno != null ? error.colno + 1 : null;
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
          snippet = getSnippet(sourceLines, getDisplayLine(line), 3);
        }
      } else if (line !== null) {
        snippet = `>>> ${getDisplayLine(line)}: [source not available]`;
      }

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

      return createNunjucksError(error.message, meta);
    }
  };
}
