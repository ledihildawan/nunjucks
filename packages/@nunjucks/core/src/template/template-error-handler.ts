import { defaultTo } from 'remeda';
import type { IncludeChain } from '@nunjucks/log';

export { createTemplateErrorHandler, buildErrorMessage, extractFrameDetails };

export interface ErrorWithLineInfo extends Error {
  lineBase?: string;
  colno?: number;
  lineno?: number;
  path?: string;
  _includeChain?: IncludeChain | null;
  getterName?: string;
  [key: string]: unknown;
}

const resolveColno = (sourceColno: number | undefined, errColno: number): number => {
  if (sourceColno && sourceColno > 0) {
    return sourceColno;
  }
  return errColno;
};

const buildErrorMessage = (currentPath: string | undefined, sourceLineno: number | undefined, finalColno: number, e: ErrorWithLineInfo): string => {
  const locationPart = sourceLineno && finalColno > 0
    ? ` [Line ${sourceLineno}, Column ${finalColno}]`
    : sourceLineno
      ? ` [Line ${sourceLineno}]`
      : '';
  return `(${currentPath})${locationPart}\n  ${e.message}`;
};

const extractFrameDetails = (
  e: ErrorWithLineInfo,
  sourceLineno: number | undefined,
  sourceColno: number | undefined,
  currentPath: string | undefined,
  hasIncludeChain: unknown
): Error | null => {
  if (hasIncludeChain) { return null; }
  if (e.lineBase === 'zero' || e.lineBase === 'one') { return null; }
  if (sourceLineno === undefined) { return null; }
  if (sourceLineno < 0) { return null; }

  const errColno = defaultTo(e.colno, 0);
  const finalColno = resolveColno(sourceColno, errColno);
  const templateLocation = `${currentPath}:${sourceLineno}:${finalColno}`;
  const msg = buildErrorMessage(currentPath, sourceLineno, finalColno, e);
  const renderLine = `at ${e.getterName ?? 'root'} (${templateLocation})`;
  const newError = Object.assign(new Error(msg), {
    name: e.name ?? 'Template render error',
    lineno: sourceLineno,
    colno: finalColno,
    lineBase: 'zero',
    _includeChain: e._includeChain ?? null,
    stack: `${msg}\n    ${renderLine}\n    at Environment.render`,
  }) as ErrorWithLineInfo;
  return newError;
};

const createTemplateErrorHandler = (state: { path: string | undefined; _includeChain: IncludeChain | null }) => {
  const enrichError = (e: ErrorWithLineInfo): Error => {
    const sourceLineno = e.lineno;
    const sourceColno = e.colno;
    const hasIncludeChain = e._includeChain ?? state._includeChain;

    const extracted = extractFrameDetails(e, sourceLineno, sourceColno, state.path, hasIncludeChain);
    if (extracted) { return extracted; }
    if (e.path) { return e; }
    return Object.assign(Object.create(Object.getPrototypeOf(e) ?? Error.prototype), e, { path: state.path }) as ErrorWithLineInfo;
  };

  return { enrichError };
};
