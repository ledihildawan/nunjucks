export const UNDEFINED_MODES = ['default', 'strict', 'debug', 'chainable'] as const;

export type UndefinedMode = (typeof UNDEFINED_MODES)[number];
