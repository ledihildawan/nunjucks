export function createWarning(message, lineno, colno, info = {}) {
  const warning = {
    message,
    lineno,
    colno,
    varName: info.varName || null,
    templateName: info.templateName || null,
    undefinedMode: info.undefinedMode || 'chainable',
    code: info.code || null,
    subject: info.subject || null
  };

  return warning;
}

import { isNonNullish } from 'remeda';

export function createUndefinedWarning(varName, lineno, colno, templateName, undefinedMode) {
  const isVar = isNonNullish(varName);
  const message = isVar
    ? `Variable '${varName}' is undefined or null`
    : 'Variable is undefined or null';

  return createWarning(message, lineno, colno, {
    varName,
    templateName,
    undefinedMode,
    code: isVar ? 'UNDEFINED_VARIABLE' : 'UNDEFINED_VALUE',
    subject: varName
  });
}
