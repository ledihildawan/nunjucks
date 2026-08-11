import { defaultTo } from 'remeda';
import type { IncludeChain } from '@nunjucks/error-formatter';

export { createTemplateErrorHandler, buildErrorMessage, extractFrameDetails };

export interface ErrorWithLineInfo extends Error {
  lineBase?: string;
  colno?: number;
  lineno?: number;
  path?: string;
  includeChain?: IncludeChain | null;
  getterName?: string;
  [key: string]: unknown;
}

const resolveColno = (sourceColno: number | undefined, errColno: number): number => {
  if (sourceColno && sourceColno > 0) {
    return sourceColno;
  }
  return errColno;
};

interface BuildErrorMessageOptions {
  currentPath: string | undefined;
  sourceLineno: number | undefined;
  finalColno: number;
  e: ErrorWithLineInfo;
}

const buildErrorMessage = ({ currentPath, sourceLineno, finalColno, e }: BuildErrorMessageOptions): string => {
  const locationPart = sourceLineno && finalColno > 0
    ? ` [Line ${sourceLineno}, Column ${finalColno}]`
    : sourceLineno
      ? ` [Line ${sourceLineno}]`
      : '';
  return `(${currentPath})${locationPart}\n  ${e.message}`;
};

interface ExtractFrameDetailsInput {
  error: ErrorWithLineInfo;
  sourceLineno: number | undefined;
  sourceColno: number | undefined;
  currentPath: string | undefined;
  hasIncludeChain: unknown;
}

const extractFrameDetails = ({ error: e, sourceLineno, sourceColno, currentPath, hasIncludeChain }: ExtractFrameDetailsInput): Error | null => {
  if (hasIncludeChain) { return null; }
  if (e.lineBase === 'zero' || e.lineBase === 'one') { return null; }
  if (sourceLineno === undefined) { return null; }
  if (sourceLineno < 0) { return null; }

  const errColno = defaultTo(e.colno, 0);
  const finalColno = resolveColno(sourceColno, errColno);
  const templateLocation = `${currentPath}:${sourceLineno}:${finalColno}`;
  const msg = buildErrorMessage({ currentPath, sourceLineno, finalColno, e });
  const renderLine = `at ${e.getterName ?? 'root'} (${templateLocation})`;
  const newError = Object.assign(new Error(msg), {
    name: e.name ?? 'Template render error',
    lineno: sourceLineno,
    colno: finalColno,
    lineBase: 'zero',
    includeChain: e.includeChain ?? null,
    stack: `${msg}\n    ${renderLine}\n    at Environment.render`,
  }) as ErrorWithLineInfo;
  return newError;
};

const createTemplateErrorHandler = (getState: () => { path: string | undefined; includeChain: IncludeChain | null }) => {
  const enrichError = (e: ErrorWithLineInfo): Error => {
    const { path, includeChain } = getState();
    const sourceLineno = e.lineno;
    const sourceColno = e.colno;
    const hasIncludeChain = e.includeChain ?? includeChain;

    const extracted = extractFrameDetails({ error: e, sourceLineno, sourceColno, currentPath: path, hasIncludeChain });
    if (extracted) { return extracted; }
    if (e.path) { return e; }
    return Object.assign(Object.create(Object.getPrototypeOf(e) ?? Error.prototype), e, { path }) as ErrorWithLineInfo;
  };

  return { enrichError };
};
