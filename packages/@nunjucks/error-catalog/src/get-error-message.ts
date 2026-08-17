const readErrorMessage = (error: unknown): string | null => {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  if ('message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return null;
};

/**
 * Resolves the human-readable message of any thrown value without throwing —
 * non-Error values degrade to `String()` and stacks are trimmed.
 */
export const getErrorMessage = (error: unknown): string => {
  const rawMessage = readErrorMessage(error);
  const baseMessage = rawMessage !== null && rawMessage !== '' ? rawMessage : String(error);
  const firstStackLine = baseMessage.indexOf('\n    at ');
  return firstStackLine !== -1 ? baseMessage.slice(0, firstStackLine) : baseMessage;
};
