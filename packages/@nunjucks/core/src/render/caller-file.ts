const CALLER_INDEX = 3;
const MIN_STACK_LENGTH = 4;

export interface CallerLocation {
  fileName: string;
  lineNumber: number | null;
  columnNumber: number | null;
}


const captureCaller = (): NodeJS.CallSite | null => {
  const original = Error.prepareStackTrace;
  let captured: NodeJS.CallSite[] | undefined;
  Error.prepareStackTrace = (_, callsite) => { captured = callsite; return callsite; };
  void new Error('caller').stack;
  Error.prepareStackTrace = original;

  if ((captured?.length ?? 0) >= MIN_STACK_LENGTH) {
    return captured?.[CALLER_INDEX] ?? null;
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
      fileName: caller.getFileName() ?? 'unknown',
      lineNumber: caller.getLineNumber?.() ?? null,
      columnNumber: caller.getColumnNumber?.() ?? null
    };
  }

  return { fileName: 'unknown', lineNumber: null, columnNumber: null };
};
