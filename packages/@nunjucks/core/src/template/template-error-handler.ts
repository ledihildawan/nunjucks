import type { IncludeChain } from '@nunjucks/error-formatter';

export { buildErrorMessage, createTemplateErrorHandler, extractFrameDetails };

/** An `Error` widened with optional template line-info fields. */
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

/** Builds the `(path) [Line, Column]\n message` display form. */
const buildErrorMessage = ({
  currentPath,
  sourceLineno,
  finalColno,
  e,
}: BuildErrorMessageOptions): string => {
  const locationPart =
    sourceLineno && finalColno > 0
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

/**
 * Rebuilds an error with synthetic frame details — only for errors lacking
 * `lineBase`, an include chain, or usable coordinates; `null` otherwise.
 */
const extractFrameDetails = ({
  error: e,
  sourceLineno,
  sourceColno,
  currentPath,
  hasIncludeChain,
}: ExtractFrameDetailsInput): Error | null => {
  if (hasIncludeChain) {
    return null;
  }
  if (e.lineBase === 'zero' || e.lineBase === 'one') {
    return null;
  }
  if (sourceLineno === undefined) {
    return null;
  }
  if (sourceLineno < 0) {
    return null;
  }

  // WHY: plain ?? — remeda's defaultTo returns the fallback only for null/undefined,
  // exactly the nullish coalescing operator's contract; remeda purged from the template domain.
  const errColno = e.colno ?? 0;
  const finalColno = resolveColno(sourceColno, errColno);
  const templateLocation = `${currentPath}:${sourceLineno}:${finalColno}`;
  const message = buildErrorMessage({ currentPath, sourceLineno, finalColno, e });
  const renderLine = `at ${e.getterName ?? 'root'} (${templateLocation})`;
  const newError = Object.assign(new Error(message), {
    name: e.name ?? 'Template render error',
    lineno: sourceLineno,
    colno: finalColno,
    lineBase: 'zero',
    includeChain: e.includeChain ?? null,
    stack: `${message}\n    ${renderLine}\n    at Environment.render`,
  }) as ErrorWithLineInfo;
  return newError;
};

/** Creates the error enricher bound to the template's path and include chain. */
const createTemplateErrorHandler = (
  getState: () => { path: string | undefined; includeChain: IncludeChain | null }
) => {
  const enrichError = (e: ErrorWithLineInfo): Error => {
    const { path, includeChain } = getState();
    const sourceLineno = e.lineno;
    const sourceColno = e.colno;
    const hasIncludeChain = e.includeChain ?? includeChain;

    const extracted = extractFrameDetails({
      error: e,
      sourceLineno,
      sourceColno,
      currentPath: path,
      hasIncludeChain,
    });
    if (extracted) {
      return extracted;
    }
    if (e.path) {
      return e;
    }
    // WHY: spread + descriptor definition instead of Object.assign — a hostile thrown
    // object can carry an own enumerable "__proto__" (e.g. via JSON.parse), and
    // Object.assign's [[Set]] semantics would forward it to the prototype setter and
    // retarget this clone; DefineOwnProperty cannot be intercepted.
    // WHY: `{ ...e }` copies only own ENUMERABLE props, so a real Error's non-enumerable
    // `message`/`stack` would be dropped and the clone rendered with an empty message;
    // re-adding them explicitly preserves plain-object error-likes unchanged.
    return Object.create(
      Object.getPrototypeOf(e) ?? Error.prototype,
      Object.getOwnPropertyDescriptors({ ...e, message: e.message, stack: e.stack, path })
    ) as ErrorWithLineInfo;
  };

  return { enrichError };
};
