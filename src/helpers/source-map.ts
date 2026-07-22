import { defaultTo, isArray } from 'remeda';
import { createSourceMap } from '@nunjucks/compiler/source-map';
import type { SourceMap, SourceMapMapping } from '@nunjucks/compiler/source-map';

export { createSourceMap };
export type { SourceMap, SourceMapMapping };

const hasValue = (value: unknown): boolean => value !== null && value !== undefined;

export function createSourceMapFromArray(templateName: string, mappingsArray: SourceMapMapping[] | null): SourceMap {
  const sm = createSourceMap(templateName);
  if (isArray(mappingsArray)) {
    sm.mappings = mappingsArray;
  }
  return sm;
}

interface SourceMapError extends Error {
  lineno?: number;
  colno?: number;
  lineBase?: string;
  _includeChain?: unknown;
  getterName?: string;
}

export function applySourceMapToError(
  error: SourceMapError,
  lineno: number,
  sourceMapData: SourceMapMapping[] | null,
  templateName: string
): SourceMapError | null {
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

export function createMappedError(
  error: SourceMapError,
  sourceMapData: SourceMapMapping[] | null,
  lineno: number,
  colno: number | undefined,
  path: string
): Error | null {
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
  const errorMessage = error.message ?? '';
  msg += `\n  ${errorMessage}`;

  const newError = new Error(msg);
  newError.name = error.name ?? 'Template render error';
  Object.assign(newError, { lineno: pos.line, colno: finalColno, lineBase: 'zero', _includeChain: error._includeChain });
  const renderLine = `at ${defaultTo(error.getterName, 'root')} (${templateLocation})`;
  newError.stack = `${newError.message}\n    ${renderLine}\n    at Environment.render`;

  return newError;
}
