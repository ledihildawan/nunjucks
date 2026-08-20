// WHY: value-based dangerous-reference detection lives in the security kernel (pure
// identity checks, no I/O) so BOTH validators (context scanning) and runtime (sandbox
// depth guard) derive from one source — runtime cannot import validators (DAG:
// validators sits above runtime).
// WHY: host-global reads happen at call time instead of module-load captures so a host
// that installs or replaces globals after module init is still detected by identity.
// WHY: globalRecord() is called once per module and cached — every checkFunction uses the
// same snapshot, which is safe because the function reads identity (same reference each time).
const globalRecord = (): Record<string, unknown> => globalThis as Record<string, unknown>;

const HOST_SNAPSHOT: Record<string, unknown> | undefined =
  typeof globalThis !== 'undefined' ? globalRecord() : undefined;

const isPrimitive = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value !== 'object' && typeof value !== 'function');

const checkGlobalThis = (value: unknown): boolean =>
  typeof globalThis !== 'undefined' && value === globalThis;
const checkProcess = (value: unknown): boolean =>
  HOST_SNAPSHOT !== undefined &&
  HOST_SNAPSHOT.process !== undefined &&
  value === HOST_SNAPSHOT.process;
const checkWindow = (value: unknown): boolean =>
  HOST_SNAPSHOT !== undefined &&
  HOST_SNAPSHOT.window !== undefined &&
  value === HOST_SNAPSHOT.window;
const checkDocument = (value: unknown): boolean =>
  HOST_SNAPSHOT !== undefined &&
  HOST_SNAPSHOT.document !== undefined &&
  value === HOST_SNAPSHOT.document;
const checkSelf = (value: unknown): boolean =>
  HOST_SNAPSHOT !== undefined &&
  HOST_SNAPSHOT.self !== undefined &&
  value === HOST_SNAPSHOT.self;
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
