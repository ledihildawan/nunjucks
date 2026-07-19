import { createLog, ERROR_DEFINITIONS } from '@nunjucks/log';

export const throwTemplateError = (
  errorDefName,
  params = {},
  subject = null,
  context = {}
) => {
  const errorDef = ERROR_DEFINITIONS[errorDefName];
  if (!errorDef) {
    throw new Error(`Unknown error definition: ${errorDefName}`);
  }
  throw createLog('error', errorDef, params, subject, {
    phase: 'compile',
    lineBase: 'zero',
    ...context
  });
};

export const throwParseError = (
  errorDefName,
  params = {},
  subject = null,
  context = {}
) => {
  const errorDef = ERROR_DEFINITIONS[errorDefName];
  if (!errorDef) {
    throw new Error(`Unknown error definition: ${errorDefName}`);
  }
  throw createLog('error', errorDef, params, subject, {
    phase: 'parse',
    lineBase: 'zero',
    ...context
  });
};

export const throwRenderError = (
  errorDefName,
  params = {},
  subject = null,
  context = {}
) => {
  const errorDef = ERROR_DEFINITIONS[errorDefName];
  if (!errorDef) {
    throw new Error(`Unknown error definition: ${errorDefName}`);
  }
  throw createLog('error', errorDef, params, subject, {
    phase: 'render',
    lineBase: 'zero',
    ...context
  });
};

export const throwWithCauses = (
  errorDefName,
  customCauses,
  customFixCode,
  params = {},
  subject = null,
  context = {}
) => {
  const errorDef = ERROR_DEFINITIONS[errorDefName];
  if (!errorDef) {
    throw new Error(`Unknown error definition: ${errorDefName}`);
  }
  const enhancedDef = {
    name: errorDef.name,
    message: errorDef.message,
    pattern: errorDef.pattern,
    causes: customCauses.length > 0 ? customCauses : (errorDef.causes || []),
    fixCode: customFixCode || errorDef.fixCode,
    fixComment: errorDef.fixComment,
    suggestion: errorDef.suggestion,
    documentationUrl: errorDef.documentationUrl,
    relatedLinks: errorDef.relatedLinks,
    severity: errorDef.severity
  };
  throw createLog('error', enhancedDef, params, subject, {
    phase: 'compile',
    lineBase: 'zero',
    ...context
  });
};
