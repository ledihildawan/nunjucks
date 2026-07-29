import { pipe, filter, split, last } from 'remeda';
import process from "node:process";

let _projectRoot: string | null = null;

const getProjectRoot = () => {
  if (_projectRoot === null) {
    _projectRoot = process.cwd();
  }
  return _projectRoot;
};

const FILE_URL_PREFIX_RE = /^file:\/\//u;
const LEADING_SLASH_DRIVE_RE = /^[\\/]+([A-Za-z]):/u;
const BACKSLASH_RE = /\\/gu;

export const normalizeDrivePath = (p: string) =>
  p.replace(FILE_URL_PREFIX_RE, '')
    .replace(LEADING_SLASH_DRIVE_RE, '$1:')
    .replace(BACKSLASH_RE, '/');

export const shortenPath = (path: string) => {
  const normalizedPath = normalizeDrivePath(path);
  const normalizedRoot = normalizeDrivePath(getProjectRoot());

  const parts = pipe(
    normalizedPath.split('/'),
    filter(Boolean)
  );
  const rootDirName = pipe(normalizedRoot, split('/'), last()) ?? '';

  const privateIdx = parts.findIndex(p =>
    p.toLowerCase() === 'users' || p.toLowerCase() === 'home'
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