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

interface LinkTarget {
  path: string;
  line: number;
  col: number;
}

const resolveIdeLink = (ide: string | IdeLinkFn, target: LinkTarget): string => {
  if (typeof ide === 'function') {
    return ide(target.path, target.line, target.col);
  }
  if (ide === 'custom') {
    return `navto:nunjucks?path=${encodeURIComponent(target.path)}&line=${target.line}&col=${target.col}`;
  }
  const normalizedPath = normalizeDrivePath(target.path);
  return `vscode://file/${normalizedPath}:${target.line}:${target.col}`;
};

// WHY: VS Code logo SVG path (simplified, fits 0 0 24 24 viewBox). Used in the error footer "Open in" button.
const VS_CODE_ICON = '<path fill="currentColor" d="M17.5 2.5L9 11l-4.5-3.5L2 9.5l4 4.5-4 4.5 2.5 2L9 17l8.5 8.5 4-2V4.5l-4-2zM17 6.5v11l-6-5.5 6-5.5z"/>';

const getIdeMeta = (_ide: string | IdeLinkFn): { label: string; color: string | null; icon: string } => ({
  label: 'VS Code',
  color: '#007ACC',
  icon: VS_CODE_ICON,
});

export { isFilePath, resolveIdeLink, getIdeMeta };
export type { LinkTarget, IdeLinkFn };
