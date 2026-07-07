import { pipe } from '../../lib/index.js';
import { createTemplateError } from './template-error.js';

const asTemplateError = (err) =>
  err.applyLocation ? err : createTemplateError(err, null, null, {
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
