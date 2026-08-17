import { pipe, split } from 'remeda';

/**
 * Extracts the final path segment, accepting both `/` and `\` separators
 * regardless of platform. Returns `'unknown'` for empty input or a trailing
 * separator.
 */
export const basename = (path: string | null | undefined): string => {
  if (!path) {
    return 'unknown';
  }
  const normalized = path.replaceAll('\\', '/');
  const parts = pipe(normalized, split('/'));
  return parts.at(-1) ?? 'unknown';
};
