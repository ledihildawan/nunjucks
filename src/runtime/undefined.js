export const UNDEFINED_MODES = ['strict', 'debug', 'chainable'];

export const DEFAULT_UNDEFINED_MODE = 'chainable';

export const isValidUndefinedMode = (mode) => UNDEFINED_MODES.includes(mode);

export function getUndefinedMode(opts) {
  if (opts?.undefined && isValidUndefinedMode(opts.undefined)) {
    return opts.undefined;
  }
  return DEFAULT_UNDEFINED_MODE;
}
