import type { CallerLocation } from '../diagnostics/error-location-types.ts';
import { captureCallerStack } from './shell/capture-caller-stack.ts';

const CALLER_INDEX = 3;
const MAX_CALLER_FRAMES = 6;

export type { CallerLocation };

const isInternalCallerFile = (fileName: string | null | undefined): boolean => {
  if (!fileName) {
    return true;
  }
  if (fileName.startsWith('node:')) {
    return true;
  }
  if (fileName.includes('node_modules')) {
    return true;
  }
  // WHY: in monorepo dev mode the engine source lives in packages/@nunjucks/ rather than node_modules/@nunjucks/. Filtering both paths ensures caller resolution always targets consumer code, never engine internals (which would false-match reserved-word subjects like 'if' against TypeScript keywords in the engine's own source). Test files (.test.) are exempt because they consume the engine's public API the same way end-user code does.
  if (fileName.includes('@nunjucks') && !fileName.includes('.test.')) {
    return true;
  }
  return false;
};

const callsiteToCallerLocation = (site: NodeJS.CallSite): CallerLocation | null => {
  const fileName = typeof site.getFileName === 'function' ? site.getFileName() : null;
  if (!fileName || isInternalCallerFile(fileName)) {
    return null;
  }
  return {
    fileName,
    lineNumber: typeof site.getLineNumber === 'function' ? (site.getLineNumber() ?? null) : null,
    columnNumber:
      typeof site.getColumnNumber === 'function' ? (site.getColumnNumber() ?? null) : null,
  };
};

// WHY: render() is often invoked through one or more user wrappers (e.g. an Express renderTemplate helper), so the template literal lives in a frame above the immediate caller. Capturing a small slice of the stack lets the resolver walk up until it finds the file that actually contains the literal, instead of fixating on the wrapper where render() is called.
/** Collects the consumer-side stack frames that may contain the template literal. */
const getCallerFrames = (): CallerLocation[] =>
  captureCallerStack()
    .slice(CALLER_INDEX, CALLER_INDEX + MAX_CALLER_FRAMES)
    .map(callsiteToCallerLocation)
    .filter((frame): frame is CallerLocation => frame !== null);

export { getCallerFrames };
