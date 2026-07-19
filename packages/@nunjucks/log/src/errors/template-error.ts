import { pipe, isNonNullish } from 'remeda';
import { formatLocationAnnotation, type LineBase } from '../render/internal/location.ts';

const TEMPLATE_ERROR = Symbol('TemplateError');

interface TemplateError extends Error {
  [TEMPLATE_ERROR]: true;
  lineno: number | null;
  colno: number | null;
  firstUpdate: boolean;
  code?: string;
  subject?: string;
  phase?: string;
  templateName?: string;
  path?: string;
  lineBase?: LineBase;
  _includeChain?: IncludeChain;
  applyLocation: (path: string | undefined, includeChain?: IncludeChain) => TemplateError;
}

interface IncludeChain {
  parentTmpl: string;
  parentLineno: number;
  parentColno?: number | null;
}

interface TemplateErrorInfo {
  code?: string;
  subject?: unknown;
  phase?: string;
  templateName?: string;
  lineBase?: LineBase;
}

interface PrettifyErrorOptions {
  path?: string;
  withInternals?: boolean;
  err: Error | TemplateError;
  includeChain?: IncludeChain;
}

export function isTemplateError(obj: unknown): obj is TemplateError {
  return (obj as TemplateError)?.[TEMPLATE_ERROR] === true;
}

export function createTemplateError(
  message: string,
  lineno: number | null,
  colno: number | null,
  info?: TemplateErrorInfo
): TemplateError {
  const err = new Error(message) as TemplateError;
  const captureStackTrace = (Error as unknown as { captureStackTrace?: (err: Error, fn: unknown) => void }).captureStackTrace;
  if (captureStackTrace) {
    captureStackTrace(err, createTemplateError);
  }
  err.name = 'Template render error';
  err[TEMPLATE_ERROR] = true;
  err.lineno = lineno;
  err.colno = colno;
  err.firstUpdate = true;
  err.lineBase = info?.lineBase ?? 'zero';
  if (info) {
    if (info.code) err.code = info.code;
    if (isNonNullish(info.subject)) err.subject = info.subject as string;
    if (info.phase) err.phase = info.phase;
    if (isNonNullish(info.templateName)) err.templateName = info.templateName as string;
  }

  err.applyLocation = function(path: string | undefined, includeChain?: IncludeChain): TemplateError {
    let msg = '(' + (path || 'unknown path') + ')';
    if (this.firstUpdate) {
      const annotation = formatLocationAnnotation(this.lineno, this.colno, this.lineBase);
      if (annotation) msg += ` ${annotation}`;
    }
    if (includeChain && this.firstUpdate) {
      msg += `\n   (included from ${includeChain.parentTmpl}:${includeChain.parentLineno}${includeChain.parentColno ? ':' + includeChain.parentColno : ''})`;
    }
    msg += '\n ';
    if (this.firstUpdate) {
      msg += ' ';
    }
    this.message = msg + (this.message || '');
    this.firstUpdate = false;
    return this;
  };

  return err;
}

const asTemplateError = (err: Error | TemplateError): TemplateError => {
  if (isTemplateError(err)) return err;
  return createTemplateError(
    err.message,
    (err as TemplateError).lineno ?? null,
    (err as TemplateError).colno ?? null,
    {
      code: (err as TemplateError).code,
      subject: (err as TemplateError).subject,
      phase: (err as TemplateError).phase,
      lineBase: (err as TemplateError).lineBase ?? 'zero'
    }
  );
};

const withLocation = ({ path, includeChain }: { path?: string; includeChain?: IncludeChain }) => (err: TemplateError): TemplateError => {
  err.applyLocation(path, includeChain);
  err.templateName = err.templateName || path;
  if (includeChain) {
    err._includeChain = includeChain;
  }
  return err;
};

const stripInternals = (path?: string) => (err: TemplateError): TemplateError => {
  const clean = new Error(err.message) as TemplateError;
  clean.name = err.name;
  clean.lineno = err.lineno;
  clean.colno = err.colno;
  clean.path = err.path || path;
  clean.templateName = err.templateName || path;
  clean.code = err.code;
  clean.subject = err.subject;
  clean.phase = err.phase;
  clean.lineBase = err.lineBase ?? 'zero';
  if (err._includeChain) {
    clean._includeChain = err._includeChain;
  }
  return clean;
};

export function prettifyError(options: PrettifyErrorOptions): TemplateError {
  const { path, withInternals, err, includeChain } = options;
  if (withInternals) {
    return pipe(err, asTemplateError, withLocation({ path, includeChain })) as TemplateError;
  }
  return pipe(err, asTemplateError, withLocation({ path, includeChain }), stripInternals(path)) as TemplateError;
}
