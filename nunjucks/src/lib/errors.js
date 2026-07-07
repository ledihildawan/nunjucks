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

  Update(path, includeChain) {
    let msg = '(' + (path || 'unknown path') + ')';
    if (this.firstUpdate) {
      if (this.lineno && this.colno) {
        msg += ` [Line ${this.lineno + 1}, Column ${this.colno + 1}]`;
      } else if (this.lineno) {
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

export function _prettifyError({ path, withInternals, err, includeChain } = {}) {
  if (!err.Update) {
    err = new TemplateError(err, null, null, {
      code: err.code,
      subject: err.subject,
      phase: err.phase
    });
  }
  err.Update(path, includeChain);
  err.templateName = err.templateName || path;

  if (includeChain) {
    err._includeChain = includeChain;
  }

  if (!withInternals) {
    const old = err;
    err = new Error(old.message);
    err.name = old.name;
    err.lineno = old.lineno;
    err.colno = old.colno;
    err.path = old.path || path;
    err.templateName = old.templateName || path;
    err.code = old.code;
    err.subject = old.subject;
    err.phase = old.phase;
    if (old._includeChain) {
      err._includeChain = old._includeChain;
    }
    if (includeChain) {
      err._includeChain = includeChain;
    }
  }

  return err;
}
