export { getErrorConfig as getConfig } from './config.js';

export {
  createErrorEnvironment as Environment,
  getEnvironment,
  renderError,
  renderErrorString,
  createErrorFormatter
} from './environment.js';

export { TemplateError, createTemplateError, prettifyError } from './core/template-error.js';
export { classifyError } from './core/classify.js';
export { resolveIdeLink, getIdeMeta } from './constants/ide-links.js';
export {
  extractUndefinedName,
  extractLineInfo,
  extractColFromMessage,
  extractIncludeChainFromMessage,
  extractErrorTemplateName
} from './core/extract.js';
export {
  normalizeLine,
  normalizeCol,
  getDisplayLine,
  getDisplayCol,
  getFallbackLine,
  getFallbackCol,
  mergeLine,
  mergeCol,
  createDisplayLine,
  createDisplayCol
} from './core/line.js';
export {
  getSnippet,
  extractLineFromSnippet,
  splitSnippetLines
} from './core/snippet.js';
export { createErrorData } from './state/error-data.js';
export { formatLocation, getDisplayMessage, formatCodeTrace } from './state/message-formatter.js';
export { toConsoleString } from './formatters/console.js';
export { toHtmlString, CSS, PRODUCTION_BODY, TOGGLE_SCRIPT } from './formatters/html/index.js';
