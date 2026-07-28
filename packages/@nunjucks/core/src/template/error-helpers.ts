import { defaultTo } from 'remeda';

export { createTemplateErrorHandler, buildErrorMessage, extractFrameDetails };

interface ErrorWithLineInfo {
  lineBase?: string;
  colno?: number;
  lineno?: number;
  message?: string;
  name?: string;
  path?: string;
  _includeChain?: unknown[];
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
  let msg = `(${currentPath})`;
  if (sourceLineno && finalColno > 0) {
    msg += ` [Line ${sourceLineno}, Column ${finalColno}]`;
  } else if (sourceLineno) {
    msg += ` [Line ${sourceLineno}]`;
  }
  msg += `\n  ${defaultTo(e.message, '')}`;
  return msg;
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
  const newError = new Error(msg) as Error & Record<string, unknown>;
  newError.name = defaultTo(e.name, 'Template render error');
  newError.lineno = sourceLineno;
  newError.colno = finalColno;
  newError.lineBase = 'zero';
  newError._includeChain = e._includeChain || null;
  const renderLine = `at ${e.getterName || 'root'} (${templateLocation})`;
  newError.stack = `${newError.message}\n    ${renderLine}\n    at Environment.render`;
  return newError;
};

const createTemplateErrorHandler = (state: { path: string | undefined; _includeChain: unknown[] | null }) => {
  const enrichError = (e: ErrorWithLineInfo) => {
    if (!e.path) { e.path = state.path; }

    const sourceLineno = e.lineno;
    const sourceColno = e.colno;
    const hasIncludeChain = e._includeChain || state._includeChain;

    return extractFrameDetails(e, sourceLineno, sourceColno, state.path, hasIncludeChain) || e;
  };

  return { enrichError };
};
