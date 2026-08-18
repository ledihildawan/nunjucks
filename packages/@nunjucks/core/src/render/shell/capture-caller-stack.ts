// WHY: V8 stack capture is the impure shell of caller resolution — it swaps the
// global Error.prepareStackTrace to intercept CallSite[] frames. Quarantined under
// render/shell/ (mirroring diagnostics/shell/ and runtime/src/shell/) so the pure
// frame-mapping logic in caller-file.ts stays side-effect free.

/**
 * Captures the V8 `CallSite[]`, restoring `prepareStackTrace` in a `finally`
 * block — the try/finally guarantees the global swap is restored even if stack
 * access throws; a leaked override would corrupt every future Error stack
 * capture in the process.
 */
const captureCallerStack = (): NodeJS.CallSite[] => {
  const original = Error.prepareStackTrace;
  let captured: NodeJS.CallSite[] | undefined;
  try {
    Error.prepareStackTrace = (_, callsite) => {
      captured = callsite;
      return callsite;
    };
    void new Error('caller').stack;
  } finally {
    Error.prepareStackTrace = original;
  }

  return captured ?? [];
};

export { captureCallerStack };
