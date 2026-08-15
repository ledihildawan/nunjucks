export const getErrorMessage = (error: unknown): string => {
  const rawMessage = (error as Error).message;
  const baseMessage = !rawMessage || typeof rawMessage !== 'string' ? String(error) : rawMessage;
  const firstStackLine = baseMessage.indexOf('\n    at ');
  return firstStackLine !== -1 ? baseMessage.slice(0, firstStackLine) : baseMessage;
};
