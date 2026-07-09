import { pipe } from 'remeda';

export class TemplateError extends Error {
  constructor(message, lineno, colno, info) {
    super(message);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    this.name = 'Template render error';
    this.lineno = lineno;
    this.colno = colno;
    this.firstUpdate = true;
    if (info) {
      if (info.code) this.code = info.code;
      if (info.subject !== undefined && info.subject !== null) this.subject = info.subject;
      if (info.phase) this.phase = info.phase;
      if (info.templateName !== undefined && info.templateName !== null) this.templateName = info.templateName;
    }
  }

  applyLocation(path, includeChain) {
    let msg = '(' + (path || 'unknown path') + ')';
    if (this.firstUpdate) {
      if (this.lineno != null && this.colno != null) {
        msg += ` [Line ${this.lineno + 1}, Column ${this.colno + 1}]`;
      } else if (this.lineno != null) {
        msg += ` [Line ${this.lineno + 1}]`;
      }
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
  }
}

export const createTemplateError = (message, lineno, colno, info) =>
  new TemplateError(message, lineno, colno, info);

const asTemplateError = (err) =>
  err.applyLocation ? err : createTemplateError(err, err.lineno ?? null, err.colno ?? null, {
    code: err.code,
    subject: err.subject,
    phase: err.phase
  });

const withLocation = ({ path, includeChain }) => (err) => {
  err.applyLocation(path, includeChain);
  err.templateName = err.templateName || path;
  if (includeChain) {
    err._includeChain = includeChain;
  }
  return err;
};

const stripInternals = (path) => (err) => {
  const clean = new Error(err.message);
  clean.name = err.name;
  clean.lineno = err.lineno;
  clean.colno = err.colno;
  clean.path = err.path || path;
  clean.templateName = err.templateName || path;
  clean.code = err.code;
  clean.subject = err.subject;
  clean.phase = err.phase;
  if (err._includeChain) {
    clean._includeChain = err._includeChain;
  }
  return clean;
};

export function prettifyError({ path, withInternals, err, includeChain } = {}) {
  const steps = [
    asTemplateError,
    withLocation({ path, includeChain }),
    ...(withInternals ? [] : [stripInternals(path)])
  ];
  return pipe(err, ...steps);
}
