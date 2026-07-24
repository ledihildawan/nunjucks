import { pipe, filter } from 'remeda';
import process from "node:process";

let _projectRoot: string | null = null;

const getProjectRoot = () => {
  if (_projectRoot === null) {
    _projectRoot = process.cwd();
  }
  return _projectRoot;
};

export const normalizeDrivePath = (p: string) => {
  let path = p.replace(/^file:\/\//u, '');
  path = path.replace(/^[\\/]+([A-Za-z]):/u, '$1:');
  path = path.replace(/\\/gu, '/');
  return path;
};

export const shortenPath = (path: string) => {
  const normalizedPath = normalizeDrivePath(path);
  const normalizedRoot = normalizeDrivePath(getProjectRoot());

  const parts = pipe(
    normalizedPath.split('/'),
    filter(Boolean)
  );
  const rootDirName = normalizedRoot.split('/').pop();

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