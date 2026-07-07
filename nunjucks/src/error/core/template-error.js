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

export const createTemplateError = (message, lineno, colno, info) =>
  new TemplateError(message, lineno, colno, info);
