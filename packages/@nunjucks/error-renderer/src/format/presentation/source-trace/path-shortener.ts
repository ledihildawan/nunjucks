import { filter, last, pipe, split } from 'remeda';

const FILE_URL_PREFIX_RE = /^file:\/\//u;
const LEADING_SLASH_DRIVE_RE = /^[\\/]+([A-Za-z]):/u;
const BACKSLASH_RE = /\\/gu;

/**
 * Normalizes a path for IDE links and display: strips a `file://` prefix, reduces a
 * leading slash before a drive letter (`/C:` → `C:`), and converts backslashes to `/`.
 */
export const normalizeDrivePath = (path: string) =>
  path
    .replace(FILE_URL_PREFIX_RE, '')
    .replace(LEADING_SLASH_DRIVE_RE, '$1:')
    .replaceAll(BACKSLASH_RE, '/');

/**
 * Shortens a deep user path around the project directory name: `/users/.../project/...`
 * collapses to `/users/.../project/...` with the middle elided; paths outside a private
 * `users`/`home` segment pass through normalized but unchanged.
 */
export const shortenPath = (path: string, projectRoot: string): string => {
  const normalizedPath = normalizeDrivePath(path);
  const normalizedRoot = normalizeDrivePath(projectRoot);

  const parts = pipe(normalizedPath.split('/'), filter(Boolean));
  const rootDirName = pipe(normalizedRoot, split('/'), last()) ?? '';

  const privateIdx = parts.findIndex(
    (part) => part.toLowerCase() === 'users' || part.toLowerCase() === 'home'
  );

  if (privateIdx !== -1) {
    const projectIdx = parts.indexOf(rootDirName);

    if (projectIdx !== -1) {
      const before = parts.slice(0, privateIdx + 1);
      const after = parts.slice(projectIdx);
      return [...before, '...', ...after].join('/');
    }

    const before = parts.slice(0, privateIdx + 1);
    const after = parts.slice(privateIdx + 2);
    return [...before, '...', ...after].join('/');
  }

  return normalizedPath;
};
