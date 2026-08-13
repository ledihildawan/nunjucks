type Phase = 'compile' | 'render' | 'load' | 'parse';

interface NodeLocation {
  lineno: number | null;
  colno: number | null;
}

const UNDEFINED_MODES = ['default', 'strict', 'debug', 'chainable'] as const;

type UndefinedMode = (typeof UNDEFINED_MODES)[number];

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

export { UNDEFINED_MODES };
export type { Phase, NodeLocation, DomPurifyConfig, UndefinedMode };
