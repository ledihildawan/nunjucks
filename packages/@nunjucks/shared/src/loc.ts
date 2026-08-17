/**
 * Defines the unique-symbol brand that makes `Loc` opaque — positions are creatable only
 * through `loc`, keeping null-coalescing centralized in a single constructor.
 */
const LOC_BRAND = Symbol('Loc');

/**
 * Defines the validated source-position type — coordinates are always concrete numbers,
 * and the symbol brand means only `loc` can mint a value.
 */
interface Loc {
  readonly lineno: number;
  readonly colno: number;
  readonly [LOC_BRAND]: true;
}

/**
 * Normalizes a nullable parser position into a `Loc`, defaulting missing coordinates to
 * `0` — the sanctioned constructor, so AST nodes never carry `null` positions internally.
 */
const loc = <T extends { lineno: number | null; colno: number | null }>(source: T): Loc => ({
  lineno: source.lineno ?? 0,
  colno: source.colno ?? 0,
  [LOC_BRAND]: true,
});

// WHY: frozen singleton — ZERO_LOC is shared by reference into every default-location
// node engine-wide; a stray write would corrupt all of them at once.
const ZERO_LOC: Loc = Object.freeze(loc({ lineno: 0, colno: 0 })) as Loc;

export type { Loc };
export { LOC_BRAND, loc, ZERO_LOC };
