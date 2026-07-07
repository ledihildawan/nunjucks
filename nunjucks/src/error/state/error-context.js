import {
  normalizeLine,
  normalizeCol,
  getDisplayLine,
  getDisplayCol
} from '../core/line-utils.js';

export const createErrorContext = (meta = {}) => {
  let _tplLine = normalizeLine(meta.line);
  let _tplCol = normalizeCol(meta.col);
  let _classified = null;
  let _snippet = null;
  let _includeChain = meta.includeChain ?? null;
  let _isProduction = meta.isProduction ?? false;
  let _originalError = meta.originalError ?? null;

  return {
    setTplLine: (line) => { _tplLine = normalizeLine(line); },
    setTplCol: (col) => { _tplCol = normalizeCol(col); },
    setClassified: (c) => { _classified = c; },
    setSnippet: (s) => { _snippet = s; },
    setIncludeChain: (chain) => { _includeChain = chain; },
    setProduction: (prod) => { _isProduction = prod; },

    getTplLine: () => _tplLine,
    getTplCol: () => _tplCol,
    getClassified: () => _classified,
    getSnippet: () => _snippet,
    getIncludeChain: () => _includeChain,
    isProduction: () => _isProduction,
    getOriginalError: () => _originalError,

    getSrcLine: () => getDisplayLine(_tplLine),
    getSrcCol: () => getDisplayCol(_tplCol),
    getDisplayLine: () => getDisplayLine(_tplLine) ?? '?',
    getDisplayCol: () => getDisplayCol(_tplCol) ?? '?',

    hasSnippet: () => _snippet !== null && _snippet !== '',
    hasClassified: () => _classified !== null,
    hasIncludeChain: () => _includeChain !== null && _includeChain.length > 0
  };
};

export const createErrorState = (error, meta = {}) => {
  const ctx = createErrorContext(meta);
  ctx.setTplLine(error?.lineno ?? meta.line);
  ctx.setTplCol(error?.colno ?? meta.col);
  ctx.setOriginalError(error);
  return ctx;
};
