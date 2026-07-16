import { classifyFromError } from './classify/classify.js';

/**
 * Parse error to structured classification data
 * @param {Error} error - Raw error from nunjucks
 * @returns {object} Classified error with category, causes, fixes
 */
export const classify = (error) => {
  if (!error) return null;

  const classified = classifyFromError(error);

  return {
    category: classified.category || 'unknown',
    message: error.message || String(error),
    undefinedName: classified.undefinedName || null,
    causes: classified.causes || [],
    fixCode: classified.fixCode || null,
    fixComment: classified.fixComment || null,
    lineno: error.lineno || null,
    colno: error.colno || null,
    rawMessage: error.message
  };
};
