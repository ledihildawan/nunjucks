const CALLER_INDEX = 3;
const MIN_STACK_LENGTH = 4;

export interface CallerLocation {
  fileName: string;
  lineNumber: number | null;
  columnNumber: number | null;
}

const captureCaller = (): NodeJS.CallSite | null => {
  const original = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, callsite) => callsite;
  const error = new Error('caller');
  const stack = error.stack as unknown as NodeJS.CallSite[] | undefined;
  Error.prepareStackTrace = original;

  if (stack && stack.length >= MIN_STACK_LENGTH) {
    return stack[CALLER_INDEX] ?? null;
  }
  return null;
};

export const getCallerFile = (): string => {
  const caller = captureCaller();
  if (caller && typeof caller.getFileName === 'function') {
    const fileName = caller.getFileName();
    if (fileName) {
      return fileName;
    }
  }

  return 'unknown';
};

export const getCallerLocation = (): CallerLocation => {
  const caller = captureCaller();
  if (caller && typeof caller.getFileName === 'function') {
    return {
      fileName: caller.getFileName() || 'unknown',
      lineNumber: caller.getLineNumber?.() || null,
      columnNumber: caller.getColumnNumber?.() || null
    };
  }

  return { fileName: 'unknown', lineNumber: null, columnNumber: null };
};
