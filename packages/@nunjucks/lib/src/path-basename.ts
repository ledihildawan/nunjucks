import { pipe, split } from 'remeda';

export const basename = (path: string | null | undefined): string => {
  if (!path) { return 'unknown'; }
  const normalized = path.replaceAll('\\', '/');
  const parts = pipe(normalized, split('/'));
  return parts.at(-1) ?? 'unknown';
};
