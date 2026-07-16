import { toHtml } from './error/to-html.js';
import { toAnsi } from './error/to-ansi.js';
import { toText } from './error/to-text.js';
import { toConsoleString } from './error/to-console.js';

export function createLog(type, data) {
  const { message, lineno: topLineno, colno: topColno, info = {} } = data;

  if (type === 'error') {
    return createErrorObject(message, topLineno, topColno, info);
  } else if (type === 'warning') {
    return createWarningObject(message, topLineno, topColno, info);
  }
  throw new Error(`Unknown log type: ${type}`);
}

function createErrorObject(message, lineno, colno, info) {
  const err = new Error(message);
  err.name = 'Template render error';
  err.lineno = lineno;
  err.colno = colno;
  err.code = info.code || null;
  err.subject = info.subject || null;
  err.phase = info.phase || null;
  err.templateName = info.templateName || null;

  err.output = function({ format, verbosity = 'full', dev = false, ide = 'vscode' } = {}) {
    const opts = {
      dev,
      ide,
      verbosity,
      phase: err.phase,
      templateName: err.templateName,
      lineno,
      colno
    };

    if (format === 'html') return toHtml(err, opts);
    if (format === 'ansi') return toAnsi(err, opts);
    if (format === 'text') return toText(err, opts);

    return { html: toHtml(err, opts), ansi: toAnsi(err, opts), text: toText(err, opts) };
  };

  return err;
}

function createWarningObject(message, lineno, colno, info) {
  const warning = {
    message,
    lineno,
    colno,
    varName: info.varName || null,
    templateName: info.templateName || null,
    undefinedMode: info.undefinedMode || 'chainable',
    code: info.code || null,
    subject: info.subject || null,

    output({ verbosity = 'full', dev = false, ide = 'vscode' } = {}) {
      return toConsoleString(warning, { verbosity, dev, ide });
    }
  };

  return warning;
}
