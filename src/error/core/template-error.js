import { pipe, isNonNullish } from 'remeda';

const TEMPLATE_ERROR = Symbol('TemplateError');

export function isTemplateError(obj) {
  return obj?.[TEMPLATE_ERROR] === true;
}

export function createTemplateError(message, lineno, colno, info) {
  const err = new Error(message);
  if (Error.captureStackTrace) {
    Error.captureStackTrace(err, createTemplateError);
  }
  err.name = 'Template render error';
  err[TEMPLATE_ERROR] = true;
  err.lineno = lineno;
  err.colno = colno;
  err.firstUpdate = true;
  if (info) {
    if (info.code) err.code = info.code;
    if (isNonNullish(info.subject)) err.subject = info.subject;
    if (info.phase) err.phase = info.phase;
    if (isNonNullish(info.templateName)) err.templateName = info.templateName;
  }

  err.applyLocation = function(path, includeChain) {
    let msg = '(' + (path || 'unknown path') + ')';
    if (this.firstUpdate) {
      if (isNonNullish(this.lineno) && isNonNullish(this.colno)) {
        msg += ` [Line ${this.lineno + 1}, Column ${this.colno + 1}]`;
      } else if (isNonNullish(this.lineno)) {
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
  };

  return err;
}

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
