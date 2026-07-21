export const UNDEFINED_MODES = ['strict', 'debug', 'chainable'] as const;

export type UndefinedMode = (typeof UNDEFINED_MODES)[number];

export const DEFAULT_UNDEFINED_MODE: UndefinedMode = 'chainable';

export const isValidUndefinedMode = (mode: unknown): mode is UndefinedMode =>
  typeof mode === 'string' && (UNDEFINED_MODES as readonly string[]).includes(mode);

export function getUndefinedMode(opts?: { undefined?: unknown } | null): UndefinedMode {
  if (opts?.undefined && isValidUndefinedMode(opts.undefined)) {
    return opts.undefined;
  }
  return DEFAULT_UNDEFINED_MODE;
}
