export const UNDEFINED_MODES = ['default', 'strict', 'debug', 'chainable'] as const;

export type UndefinedMode = (typeof UNDEFINED_MODES)[number];

export const DEFAULT_UNDEFINED_MODE: UndefinedMode = 'chainable';

export const isValidUndefinedMode = (mode: unknown): mode is UndefinedMode =>
  typeof mode === 'string' && (UNDEFINED_MODES as readonly string[]).includes(mode);

export const getUndefinedMode = (options?: { undefined?: unknown } | null): UndefinedMode => {
  if (options?.undefined && isValidUndefinedMode(options.undefined)) {
    return options.undefined;
  }
  return DEFAULT_UNDEFINED_MODE;
};
