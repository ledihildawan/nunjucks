import { PATTERNS } from '../constants/patterns.js';
import { ERROR_RULES } from '../constants/mappings.js';
import { extractUndefinedName } from './extract.js';

const extractSubject = (rule, message) => {
  switch (rule.subjectFrom) {
    case 'undefinedName':
      return extractUndefinedName(message);
    case 'filter':
      return message.match(PATTERNS.UNDEFINED_FILTER)?.[1] || null;
    case 'quotes':
      return (message.match(/"([^"]+)"/) || [])[1] || null;
    case 'fileNotFound':
      return message.match(PATTERNS.FILE_NOT_FOUND)?.[1] || 'unknown';
    default:
      return null;
  }
};

const resolve = (field, subject) =>
  typeof field === 'function' ? field(subject) : field;

const classifyFilterError = (rawMessage) => {
  const errorMsg = rawMessage.match(PATTERNS.FILTER_ERROR)?.[1] || rawMessage;
  const isAsyncError = /async filter|promise|rejected|await|network/i.test(errorMsg);

  const fixCode = isAsyncError
    ? `// Async filter error - wrap in try-catch or handle rejections
async function myFilter(value) {
  try {
    return await someAsyncOperation(value);
  } catch (err) {
    console.error('Filter failed:', err.message);
    return value; // or a default value
  }
}`
    : `// Filter error - check input values and implementation
function myFilter(value) {
  if (value == null) return '';
  // ... filter logic
}`;

  return {
    category: 'filter_error',
    undefinedName: null,
    causes: [
      '**Filter threw an error** during execution',
      '**Error**: `' + errorMsg + '`',
      isAsyncError
        ? '**Async filter** must handle rejections with `try-catch`'
        : 'Filter should handle **null/undefined** inputs'
    ],
    fixCode,
    fixComment: `// Fix: ${isAsyncError ? 'Handle async errors with try-catch' : 'Check filter input validation'}`
  };
};

export const classifyError = (rawMessage) => {
  if (!rawMessage) return null;

  for (const rule of ERROR_RULES) {
    if (!rule.pattern.test(rawMessage)) continue;
    const subject = extractSubject(rule, rawMessage);
    return {
      category: rule.category,
      undefinedName: subject,
      causes: resolve(rule.causes, subject),
      fixCode: resolve(rule.fixCode, subject),
      fixComment: resolve(rule.fixComment, subject)
    };
  }

  if (PATTERNS.FILTER_ERROR.test(rawMessage)) {
    return classifyFilterError(rawMessage);
  }

  return null;
};

export const classifyFromError = (error) => {
  if (!error) return null;
  if (error.code === 'FILTER_ERROR') {
    return classifyFilterError(error.message || '');
  }
  return classifyError(error.message || '');
};
