type Phase = 'compile' | 'render' | 'load' | 'parse';

interface NodeLocation {
  lineno: number | null;
  colno: number | null;
}

const UNDEFINED_MODES = ['default', 'strict', 'debug', 'chainable'] as const;

type UndefinedMode = (typeof UNDEFINED_MODES)[number];

// WHY: modes the runtime undefined-resolution path handles explicitly — 'default' passes
// through with no rule and never reaches the resolver, so its type excludes it.
const HANDLED_UNDEFINED_MODES = ['chainable', 'strict', 'debug'] as const satisfies readonly UndefinedMode[];

type HandledUndefinedMode = (typeof HANDLED_UNDEFINED_MODES)[number];

// WHY: the assumed mode when undefined-handling metadata omits one (warning envelopes,
// compiler internals) — deliberately NOT the user-facing render default, which is 'default'.
const DEFAULT_UNDEFINED_MODE: HandledUndefinedMode = 'chainable';

const SANDBOX_MODES = ['blocklist', 'allowlist'] as const;

type SandboxMode = (typeof SANDBOX_MODES)[number];

const CONTENT_TYPES = ['html', 'json', 'text'] as const;

type ContentType = (typeof CONTENT_TYPES)[number];

interface DomPurifyConfig {
  ALLOWED_TAGS?: string[];
  ALLOWED_ATTR?: string[];
  ALLOWED_DATA_ATTR?: boolean;
  KEEP_CONTENT?: boolean;
  RETURN_DOM?: boolean;
  RETURN_DOM_FRAGMENT?: boolean;
  FORBID_TAGS?: string[];
  FORBID_ATTR?: string[];
  ALLOW_ARIA_ATTR?: boolean;
  ALLOW_DATA_ATTR?: boolean;
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
