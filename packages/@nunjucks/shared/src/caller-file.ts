const CALLER_INDEX = 2;
const MIN_STACK_LENGTH = 3;

export interface CallerLocation {
  fileName: string;
  lineNumber: number | null;
  columnNumber: number | null;
}

export const getCallerFile = (): string => {
  const original = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, callsite) => callsite;
  const error = new Error('getCallerFile');
  const stack = error.stack as unknown as NodeJS.CallSite[] | undefined;
  Error.prepareStackTrace = original;

  if (stack && stack.length >= MIN_STACK_LENGTH) {
    const caller = stack[CALLER_INDEX];
    if (caller && typeof caller.getFileName === 'function') {
      const fileName = caller.getFileName();
      if (fileName) {
        return fileName;
      }
    }
  }

  return 'unknown';
};

export const getCallerLocation = (): CallerLocation => {
  const original = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, callsite) => callsite;
  const error = new Error('getCallerLocation');
  const stack = error.stack as unknown as NodeJS.CallSite[] | undefined;
  Error.prepareStackTrace = original;

  if (stack && stack.length >= MIN_STACK_LENGTH) {
    const caller = stack[CALLER_INDEX];
    if (caller && typeof caller.getFileName === 'function') {
      const fileName = caller.getFileName();
      return {
        fileName: fileName || 'unknown',
        lineNumber: caller.getLineNumber?.() || null,
        columnNumber: caller.getColumnNumber?.() || null
      };
    }
  }

  return { fileName: 'unknown', lineNumber: null, columnNumber: null };
};
