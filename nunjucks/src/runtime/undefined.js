export const UNDEFINED_MODES = ['strict', 'debug', 'chainable'];

export const DEFAULT_UNDEFINED_MODE = 'chainable';

export const isValidUndefinedMode = (mode) => UNDEFINED_MODES.includes(mode);

export function handleUndefined(varName, lineno, colno, mode) {
  const message = `undefined variable '${varName}'`;

  switch (mode) {
    case 'strict':
      return { error: true, value: undefined };

    case 'debug':
      console.warn(`[nunjucks] Warning: ${message} at line ${lineno}:${colno}`);
      return { error: false, value: 'undefined' };

    case 'chainable':
    default:
      return { error: false, value: 'undefined' };
  }
}

export function convertThrowOnUndefined(undefinedOption) {
  if (undefinedOption !== undefined && isValidUndefinedMode(undefinedOption)) {
    return undefinedOption;
  }

  return DEFAULT_UNDEFINED_MODE;
}
