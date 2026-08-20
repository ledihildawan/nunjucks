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
  // WHY: a trailing separator yields an empty final segment — the doc promises
  // 'unknown' there, same as for empty input.
  const last = parts.at(-1);
  return last ? last : 'unknown';
};
