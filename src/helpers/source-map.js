import { defaultTo, isArray } from 'remeda';
import { createSourceMap } from '@nunjucks/compiler/source-map';

export { createSourceMap };

const hasValue = (value) => value !== null && value !== undefined;

export function createSourceMapFromArray(templateName, mappingsArray) {
  const sm = createSourceMap(templateName);
  if (isArray(mappingsArray)) {
    sm.mappings = mappingsArray;
  }
  return sm;
}

export function applySourceMapToError(error, lineno, sourceMapData, templateName) {
  if (!sourceMapData || !isArray(sourceMapData)) {
    return null;
  }

  const sm = createSourceMapFromArray(templateName, sourceMapData);
  const pos = sm.getOriginalPosition(lineno);

  if (error.lineno === undefined) {
    error.lineno = pos.line;
  }
  if (error.colno === undefined) {
    error.colno = pos.col;
  }
  error.lineBase = 'zero';

  return error;
}

export function createMappedError(error, sourceMapData, lineno, colno, path) {
  if (!sourceMapData || !isArray(sourceMapData)) {
    return null;
  }

  const sm = createSourceMapFromArray(path, sourceMapData);
  const pos = sm.getOriginalPosition(lineno);

  const errColno = defaultTo(error.colno, 0);
  const finalColno = pos.col > 0 ? pos.col : errColno;
  const displayLine = pos.line + 1;
  const displayCol = finalColno + 1;
  const templateLocation = `${path}:${displayLine}:${displayCol}`;

  let msg = `(${path})`;
  if (hasValue(pos.line)) {
    if (hasValue(finalColno)) {
      msg += ` [Line ${displayLine}, Column ${displayCol}]`;
    } else {
      msg += ` [Line ${displayLine}]`;
    }
  }
  msg += `\n  ${defaultTo(error.message, '')}`;

  const newError = new Error(msg);
  newError.name = defaultTo(error.name, 'Template render error');
  newError.lineno = pos.line;
  newError.colno = finalColno;
  newError.lineBase = 'zero';
  newError._includeChain = error._includeChain;
  const renderLine = `at ${defaultTo(error.getterName, 'root')} (${templateLocation})`;
  newError.stack = `${newError.message}\n    ${renderLine}\n    at Environment.render`;

  return newError;
}
