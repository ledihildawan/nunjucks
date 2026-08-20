import { isRecord } from './types.ts';

/** Defines the unique symbol that brands an `Error` as an internal engine invariant violation. */
const INTERNAL_INVARIANT = Symbol('InternalInvariant');

/**
 * A programmer-bug error: an internal engine invariant was violated. Deliberately
 * NOT branded with `TEMPLATE_ERROR`, so Result boundaries (e.g. `parse`) keep
 * propagating it as a crash instead of mapping it to a user-facing catalog error.
 */
interface InternalInvariantError extends Error {
  readonly [INTERNAL_INVARIANT]: true;
}

// WHY: `in` narrowing types the symbol-keyed access, so no cast is needed — the guard
// reads the brand directly off the narrowed record.
/** Narrows to the internal-invariant branded error. */
const isInternalInvariantError = (value: unknown): value is InternalInvariantError =>
  isRecord(value) && INTERNAL_INVARIANT in value && value[INTERNAL_INVARIANT] === true;

/**
 * Constructs a programmer-bug error branded as an internal engine invariant violation.
 * Deliberately NOT branded with `TEMPLATE_ERROR`, so Result boundaries (e.g. `parse`)
 * propagate it as a crash rather than mapping it to a user-facing catalog error.
 *
 * @param message - Human-readable description of which invariant was violated.
 * @returns An `InternalInvariantError` bearing the `INTERNAL_INVARIANT` brand.
 */
const createInternalInvariantError = (message: string): InternalInvariantError =>
  Object.assign(new Error(`internal invariant violated: ${message}`), {
    [INTERNAL_INVARIANT]: true as const,
  });

export type { InternalInvariantError };
export { createInternalInvariantError, INTERNAL_INVARIANT, isInternalInvariantError };
