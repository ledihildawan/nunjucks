import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type { ErrorDefinitionEntry } from '@nunjucks/error-formatter';
import type { Phase, UndefinedMode } from '@nunjucks/shared';
import { throwRuntimeError } from './error-context.ts';
import type { NullAccessResult, PropertyNotFoundResult } from './member-access.ts';
import { emitUndefinedWarning } from './shell/warning-emitter.ts';

export interface ResolveUndefinedOptions {
  runtimeContext: unknown;
  subjectValue: unknown;
  varName: string | null;
  lineno?: number | null;
  colno?: number | null;
  // WHY: full UndefinedMode — 'default' flows here from user config via emitted code;
  // only 'strict' (throw) and 'debug' (warn) have behavior, all others fall through.
  mode: UndefinedMode;
  phase: Phase;
  templateName: string;
}

interface UndefinedResolution {
  errorDef: ErrorDefinitionEntry;
  params: Record<string, string>;
  subject: string | null;
  warningName: string;
  warningMessage: () => string;
}

const resolveUndefined = (
  options: ResolveUndefinedOptions,
  resolution: UndefinedResolution
): 'undefined' => {
  const { runtimeContext, lineno, colno, mode, phase, templateName } = options;

  if (mode === 'strict') {
    throwRuntimeError(resolution.errorDef, {
      runtimeContext,
      lineno,
      colno,
      params: resolution.params,
      subject: resolution.subject,
      templateName,
    });
  }

  if (mode === 'debug') {
    emitUndefinedWarning(runtimeContext, {
      name: resolution.warningName,
      message: resolution.warningMessage,
      subject: resolution.subject,
      lineno,
      colno,
      phase,
      templateName,
      mode,
      varName: resolution.subject,
    });
  }

  return 'undefined';
};

export const resolveUndefinedProperty = (
  value: PropertyNotFoundResult,
  options: ResolveUndefinedOptions
): 'undefined' => {
  const { varName } = options;
  const accessPath = value.__nunjucks_access_path__ ?? varName ?? 'unknown';
  const parentName =
    !value.__nunjucks_parent__ && varName?.includes('.')
      ? varName.slice(0, varName.lastIndexOf('.'))
      : value.__nunjucks_parent__;
  return resolveUndefined(options, {
    errorDef: ERROR_DEFINITIONS.UNDEFINED_PROPERTY,
    params: { property: accessPath, parent: parentName ?? 'unknown' },
    subject: accessPath,
    warningName: ERROR_DEFINITIONS.UNDEFINED_PROPERTY.name,
    warningMessage: () => `Property '${accessPath}' not found in '${parentName ?? 'unknown'}'`,
  });
};

export const resolveNullAccess = (
  value: NullAccessResult,
  options: ResolveUndefinedOptions
): 'undefined' => {
  const { varName } = options;
  const accessPath = value.__nunjucks_access_path__ ?? varName ?? 'unknown';
  const parentName = value.__nunjucks_parent__ ?? varName ?? 'unknown';
  return resolveUndefined(options, {
    errorDef: ERROR_DEFINITIONS.NULL_VALUE,
    params: { accessPath, state: 'null', parent: parentName },
    subject: accessPath,
    warningName: ERROR_DEFINITIONS.NULL_VALUE.name,
    warningMessage: () => `Cannot access '${accessPath}' on null '${parentName}'`,
  });
};

export const resolveUndefinedValue = (options: ResolveUndefinedOptions): 'undefined' => {
  const { varName } = options;
  const errorDef: ErrorDefinitionEntry = varName
    ? ERROR_DEFINITIONS.UNDEFINED_VARIABLE
    : ERROR_DEFINITIONS.UNDEFINED_VALUE;
  return resolveUndefined(options, {
    errorDef,
    params: { name: varName ?? '' },
    subject: varName,
    warningName: ERROR_DEFINITIONS.UNDEFINED_VARIABLE.name,
    warningMessage: () =>
      varName ? `Variable '${varName}' is undefined or null` : 'Variable is undefined or null',
  });
};
