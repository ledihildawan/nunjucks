/**
 * Defines the pipeline stage an error or event is attributed to (`parse`, `compile`,
 * `load`, `render`).
 */
type Phase = 'compile' | 'render' | 'load' | 'parse';

/**
 * Defines the raw parser position — coordinates are nullable because synthesized nodes
 * carry no location; convert through `loc` for the non-nullable form.
 */
interface NodeLocation {
  lineno: number | null;
  colno: number | null;
}

// WHY: frozen at module init — these arrays back runtime membership validation; a
// stray push from anywhere would silently widen the accepted config surface.
const UNDEFINED_MODES = Object.freeze(['default', 'strict', 'debug', 'chainable'] as const);

/** Narrows the undefined-handling mode values — members flow from `UNDEFINED_MODES`. */
type UndefinedMode = (typeof UNDEFINED_MODES)[number];

// WHY: modes the runtime undefined-resolution path handles explicitly — 'default' passes
// through with no rule and never reaches the resolver, so its type excludes it.
const HANDLED_UNDEFINED_MODES = Object.freeze([
  'chainable',
  'strict',
  'debug',
] as const satisfies readonly UndefinedMode[]);

/** Narrows the resolver-handled modes — excludes `'default'`, which passes through untouched. */
type HandledUndefinedMode = (typeof HANDLED_UNDEFINED_MODES)[number];

// WHY: the assumed mode when undefined-handling metadata omits one (warning envelopes,
// compiler internals) — deliberately NOT the user-facing render default, which is 'default'.
const DEFAULT_UNDEFINED_MODE: HandledUndefinedMode = 'chainable';

/**
 * Freezes the supported sandbox modes — the runtime derives both the `SandboxMode` union
 * and its membership validation from this tuple.
 */
const SANDBOX_MODES = Object.freeze(['blocklist', 'allowlist'] as const);

/** Narrows the sandbox policy selector — members derive from `SANDBOX_MODES`. */
type SandboxMode = (typeof SANDBOX_MODES)[number];

/**
 * Freezes the template content types — the `ContentType` union and its config validation
 * both derive from this tuple, keeping accepted values single-sourced.
 */
const CONTENT_TYPES = Object.freeze(['html', 'json', 'text'] as const);

/** Narrows the template content type — members derive from `CONTENT_TYPES`. */
type ContentType = (typeof CONTENT_TYPES)[number];

/**
 * Defines the hand-picked DOMPurify option subset exposed by template config — mirrored
 * structurally so shared stays free of a DOMPurify type dependency.
 */
interface DomPurifyConfig {
  ALLOWED_TAGS?: string[];
  ALLOWED_ATTR?: string[];
  ALLOW_DATA_ATTR?: boolean;
  KEEP_CONTENT?: boolean;
  RETURN_DOM?: boolean;
  RETURN_DOM_FRAGMENT?: boolean;
  FORBID_TAGS?: string[];
  FORBID_ATTR?: string[];
  ALLOW_ARIA_ATTR?: boolean;
}

export type {
  ContentType,
  DomPurifyConfig,
  HandledUndefinedMode,
  NodeLocation,
  Phase,
  SandboxMode,
  UndefinedMode,
};
export {
  CONTENT_TYPES,
  DEFAULT_UNDEFINED_MODE,
  HANDLED_UNDEFINED_MODES,
  SANDBOX_MODES,
  UNDEFINED_MODES,
};
