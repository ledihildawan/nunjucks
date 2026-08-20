/**
 * Matches identifiers that are structurally safe to emit as plain JavaScript
 * binding names — the single source of truth shared by the parser's template
 * literal validation and the compiler's codegen assertions, so the two ends
 * of the pipeline cannot drift apart on what counts as emittable.
 */
const SAFE_IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/u;

/**
 * Returns `true` when `name` can be emitted as an unquoted JavaScript
 * identifier without rewriting or bracket notation.
 */
const isSafeIdentifier = (name: string): boolean => SAFE_IDENTIFIER_RE.test(name);

export { isSafeIdentifier, SAFE_IDENTIFIER_RE };
