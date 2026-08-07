import { normalizeDrivePath } from '../location/path-shortener.ts';

const FILE_PATH_PATTERN = /\.(njk|nunjucks|js|ts|mjs|cjs|jsx|tsx|html|htm|tmpl|tpl|pug|ejs|handlebars|hbs|erb|php|py|rb|go|java|c|cpp|h|cs|rs|swift|kt|scala|css|scss|sass|less|styl|json|yaml|yml|xml|md|txt)$/iu;

const NATIVE_FRAME_RE = /^native$/iu;
const ANGLE_PREFIX_RE = /^</u;

const isFilePath = (path?: string | null): boolean =>
  typeof path === 'string' &&
  path.trim() !== '' &&
  !NATIVE_FRAME_RE.test(path.trim()) &&
  !ANGLE_PREFIX_RE.test(path.trim()) &&
  FILE_PATH_PATTERN.test(path);

type IdeLinkFn = (path: string, line: number, col: number) => string;

const resolveIdeLink = (ide: string | IdeLinkFn, path: string, line: number, col: number): string => {
  if (typeof ide === 'function') {
    return ide(path, line, col);
  }
  if (ide === 'custom') {
    return `navto:nunjucks?path=${encodeURIComponent(path)}&line=${line}&col=${col}`;
  }
  const normalizedPath = normalizeDrivePath(path);
  return `vscode://file/${normalizedPath}:${line}:${col}`;
};

const getIdeMeta = (_ide: string | IdeLinkFn): { label: string; color: string | null; icon: string } => ({
  label: 'VS Code',
  color: '#007ACC',
  icon: '',
});

export { isFilePath, resolveIdeLink, getIdeMeta };
