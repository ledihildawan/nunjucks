import { createErrorEnvelope, resolveMessage } from './create-log-helpers.ts';
import type {
  ErrorDefinitionEntry,
  NormalizedErrorContext,
  NormalizedWarningContext,
  TemplateError,
  TemplateWarning,
} from './create-log-types.ts';

const buildErrorJson = (err: TemplateError) => (): Record<string, unknown> => ({
  name: err.name,
  code: err.code,
  subject: err.subject,
  message: err.message,
  phase: err.phase,
  templateName: err.templateName,
  templatePath: err.templatePath,
  sourceStartLine: err.sourceStartLine,
  lineno: err.lineno,
  colno: err.colno,
  lineBase: err.lineBase,
  causes: err.causes,
  fixCode: err.fixCode,
  fixComment: err.fixComment,
  severity: err.severity,
  stack: err.stack,
});

interface CreateErrorFromDefOptions {
  errorDef: ErrorDefinitionEntry;
  paramsValue: Record<string, string> | undefined;
  normalized: NormalizedErrorContext;
  extra: Record<string, unknown> | undefined;
  subject: string | null;
}

/**
 * Builds a branded `TemplateError` from a catalog definition: resolves the
 * message with `params`, spreads the normalized context, promotes
 * `extra.sourceContent`/`extra.sourceStartLine` when string/number, copies
 * causes/fix/severity fields, and attaches a `toJSON` snapshot.
 */
const createErrorFromDef = ({
  errorDef,
  paramsValue,
  normalized,
  extra,
  subject,
}: CreateErrorFromDefOptions): TemplateError => {
  const err = createErrorEnvelope(resolveMessage(errorDef.message, paramsValue));
  Object.assign(err, {
    name: 'Template render error',
    code: errorDef.name,
    subject,
    ...normalized,
  });
  if (typeof extra?.sourceContent === 'string') {
    err.sourceContent = extra.sourceContent;
  }
  if (typeof extra?.sourceStartLine === 'number') {
    err.sourceStartLine = extra.sourceStartLine;
  }
  err.templatePath = normalized.templateName;
  if (errorDef.causes?.length) {
    err.causes = [...errorDef.causes];
  }
  if (errorDef.fixCode) {
    err.fixCode = errorDef.fixCode;
  }
  if (errorDef.fixComment) {
    err.fixComment = errorDef.fixComment;
  }
  if (errorDef.documentationUrl) {
    err.documentationUrl = errorDef.documentationUrl;
  }
  if (errorDef.severity) {
    err.severity = errorDef.severity;
  }
  err.toJSON = buildErrorJson(err);
  return err;
};

interface CreateWarningFromDefOptions {
  errorDef: ErrorDefinitionEntry;
  paramsValue: Record<string, string> | undefined;
  normalizedWarning: NormalizedWarningContext;
  subject: string | null;
}

/**
 * Builds the data-only `TemplateWarning` counterpart of `createErrorFromDef`:
 * resolves the message with `params`, spreads the normalized warning context
 * (which supplies `varName` and defaulted `undefinedMode`), and copies causes
 * and fix hints when the definition provides them.
 */
const createWarningFromDef = ({
  errorDef,
  paramsValue,
  normalizedWarning,
  subject,
}: CreateWarningFromDefOptions): TemplateWarning => {
  const warn = {
    message: resolveMessage(errorDef.message, paramsValue),
    code: errorDef.name,
    subject,
    ...normalizedWarning,
  } as TemplateWarning;
  if (errorDef.causes?.length) {
    warn.causes = [...errorDef.causes];
  }
  if (errorDef.fixCode) {
    warn.fixCode = errorDef.fixCode;
  }
  if (errorDef.fixComment) {
    warn.fixComment = errorDef.fixComment;
  }
  return warn;
};

export { createErrorFromDef, createWarningFromDef };
