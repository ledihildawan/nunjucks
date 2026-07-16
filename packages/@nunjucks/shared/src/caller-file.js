export const getCallerFile = () => {
  const original = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stack) => stack;
  const stack = new Error().stack;
  Error.prepareStackTrace = original;

  if (stack && stack.length >= 3) {
    const caller = stack[2];
    if (caller && typeof caller.getFileName === 'function') {
      const fileName = caller.getFileName();
      if (fileName) {
        return fileName;
      }
    }
  }

  return 'unknown';
};

export const getCallerLocation = () => {
  const original = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stack) => stack;
  const stack = new Error().stack;
  Error.prepareStackTrace = original;

  if (stack && stack.length >= 3) {
    const caller = stack[2];
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