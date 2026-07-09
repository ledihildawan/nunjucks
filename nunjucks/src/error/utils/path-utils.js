const normalizePath = (p) => p.replace(/^file:\/\/+/, '');

const PROJECT_ROOT = process.cwd();

export const normalizeDrivePath = (p) => p.replace(/^[\\\/]+([A-Za-z]):/, '$1:').replace(/\\/g, '/');

export const shortenPath = (path) => {
  const normalizedPath = normalizeDrivePath(path);
  const normalizedRoot = normalizeDrivePath(PROJECT_ROOT);

  const parts = normalizedPath.split('/').filter(Boolean);
  const rootDirName = normalizedRoot.split('/').pop();

  const privateIdx = parts.findIndex(p =>
    p.toLowerCase() === 'users' || p.toLowerCase() === 'home'
  );

  if (privateIdx !== -1) {
    const projectIdx = parts.findIndex(p => p === rootDirName);

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
