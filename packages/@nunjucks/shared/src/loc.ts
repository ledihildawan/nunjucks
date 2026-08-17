const LOC_BRAND = Symbol('Loc');

interface Loc {
  readonly lineno: number;
  readonly colno: number;
  readonly [LOC_BRAND]: true;
}

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
