import { readObject, readString } from './type-guards.ts';

// WHY: error objects cross package boundaries as `unknown` (thrown values, stream
// sentinels, diagnostics snapshots). This is the single narrowing helper for the
// optional `code` field — fatal-stream classification and severity resolution all
// read the same property, so the access lives here once.
/**
 * Reads the error code from an unknown error object.
 * @param error - The error object to read from.
 * @returns The error code string, or null if not found.
 */
const readErrorCode = (error: unknown): string | null => {
  const source = readObject(error);
  return readString(source.code);
};

export { readErrorCode };
