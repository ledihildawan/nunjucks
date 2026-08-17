// WHY: value-based dangerous-reference detection lives in shared (pure identity checks,
// no I/O) so BOTH validators (context scanning) and runtime (sandbox depth guard) derive
// from one source — runtime cannot import validators (DAG: validators sits above runtime).
const globalRecord = globalThis as Record<string, unknown>;

const isPrimitive = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value !== 'object' && typeof value !== 'function');

const checkGlobalThis = (value: unknown): boolean =>
  typeof globalThis !== 'undefined' && value === globalThis;
const checkProcess = (value: unknown): boolean =>
  globalRecord.process !== undefined && value === globalRecord.process;
const checkWindow = (value: unknown): boolean =>
  globalRecord.window !== undefined && value === globalRecord.window;
const checkDocument = (value: unknown): boolean =>
  globalRecord.document !== undefined && value === globalRecord.document;
const checkSelf = (value: unknown): boolean =>
  globalRecord.self !== undefined && value === globalRecord.self;
const checkBuffer = (value: unknown): boolean =>
  typeof Buffer !== 'undefined' && value instanceof Buffer;

/**
 * Detects dangerous host references by value identity rather than shape — primitives are
 * always safe, and every per-global check tolerates hosts where that global is absent.
 */
const isDangerousReference = (value: unknown): boolean => {
  if (isPrimitive(value)) {
    return false;
  }
  return (
    checkGlobalThis(value) ||
    checkProcess(value) ||
    checkWindow(value) ||
    checkDocument(value) ||
    checkSelf(value) ||
    checkBuffer(value)
  );
};

export { isDangerousReference };
