import {
  extractIncludeChainFromMessage,
  extractErrorTemplateName
} from '../core/extract.js';
import { extractLineFromSnippet } from '../core/snippet.js';
import { createErrorData } from '../state/data.js';
import { toConsoleString } from '../formatters/console.js';
import { toHtmlString } from '../formatters/html.js';

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

export const createNunjucksError = (message, errorData) => {
  const fallbackLine = () => extractLineFromSnippet(errorData.snippet) ?? errorData.line;

  return {
    name: 'NunjucksError',
    message,
    errorId: errorData.errorId,
    timestamp: errorData.timestamp,
    code: errorData.code,
    subject: errorData.subject,
    phase: errorData.phase,
    templateName: errorData.templateName,
    templatePath: errorData.templatePath,
    originalError: errorData.originalError,
    classified: errorData.classified,

    getSrcLine: () => errorData.line,
    getSrcCol: () => errorData.col,
    getDisplayLine: errorData.getDisplayLine,
    getDisplayCol: errorData.getDisplayCol,
    getSrcLineFallback: fallbackLine,
    getDisplayLineFallback: () => fallbackLine() ?? '?',

    get sourceLine() { return errorData.sourceLine; },
    get renderContext() { return errorData.renderContext; },
    get snippet() { return errorData.snippet; },
    get includeChain() { return errorData.includeChain; },
    get isProduction() { return errorData.isProduction; },

    toConsoleString: () => toConsoleString(errorData),
    toHtmlString: () => toHtmlString(errorData)
  };
};

export const createErrorFormatter = ({ fs = defaultFs, autoDetect = true } = {}) => {
  return {
    async formatError(error, templateName, includeChain = null, templatePath = null, renderContext = null) {
      const isProduction = !autoDetect ? false : (error.lineno == null);

      const effectiveChain = includeChain ?? error._includeChain ?? null;
      const chainFromMessage = extractIncludeChainFromMessage(error.message);

      const chainForDisplay = effectiveChain
        ? (Array.isArray(effectiveChain) ? effectiveChain : [effectiveChain])
        : chainFromMessage;

      const hasIncludeChain = chainForDisplay && chainForDisplay.length > 0;
      const extractedTemplateName = hasIncludeChain ? null : extractErrorTemplateName(error.message);
      const actualTemplateName = (hasIncludeChain ? error.path : null) ?? extractedTemplateName ?? templateName;
      const actualTemplatePath = templatePath ?? error.templatePath ?? null;

      const lineOverride = error.lineno != null ? error.lineno + 1 : null;
      const colOverride = error.colno != null ? error.colno + 1 : null;

      let sourceContent = null;
      if (templatePath) {
        try {
          sourceContent = fs.readFileSync(templatePath, 'utf-8');
        } catch (e) {
          sourceContent = null;
        }
      }

      const errorData = createErrorData(error, {
        templateName: actualTemplateName,
        templatePath: actualTemplatePath,
        sourceContent,
        includeChain: chainForDisplay,
        isProduction,
        line: lineOverride,
        col: colOverride,
        renderContext
      });

      return createNunjucksError(error.message, errorData);
    }
  };
}
