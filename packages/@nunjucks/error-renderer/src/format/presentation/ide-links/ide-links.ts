import { normalizeDrivePath } from '../source-trace/path-shortener.ts';

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

type IdeType = 'vscode' | 'cursor' | 'jetbrains' | 'sublime' | 'zed' | 'textmate' | 'bbedit' | 'custom' | 'unknown';

const resolveIdeLink = (ide: string | IdeLinkFn, target: LinkTarget): string => {
  if (typeof ide === 'function') {
    return ide(target.path, target.line, target.col);
  }

  const normalizedPath = normalizeDrivePath(target.path);

  if (ide === 'custom') {
    return `navto:nunjucks?path=${encodeURIComponent(target.path)}&line=${target.line}&col=${target.col}`;
  }

  const normalizedIde = (ide || 'unknown').toLowerCase().trim();

  if (normalizedIde === 'vscode' || normalizedIde === 'code') {
    return `vscode://file/${normalizedPath}:${target.line}:${target.col}`;
  }

  if (normalizedIde === 'cursor') {
    return `vscode://file/${normalizedPath}:${target.line}:${target.col}`;
  }

  if (normalizedIde === 'zed') {
    return `zed://open?file=${encodeURIComponent(normalizedPath)}&line=${target.line}&col=${target.col}`;
  }

  if (normalizedIde === 'textmate') {
    return `txmt://open?url=file://${encodeURIComponent(normalizedPath)}&line=${target.line}&column=${target.col}`;
  }

  if (normalizedIde === 'bbedit') {
    return `bbedit://${normalizedPath}?line=${target.line}`;
  }

  if (normalizedIde === 'sublime' || normalizedIde === 'subl') {
    return `subl://open?url=file://${encodeURIComponent(normalizedPath)}&line=${target.line}`;
  }

  if (normalizedIde === 'jetbrains' || normalizedIde === 'intellij' || normalizedIde === 'pycharm' || normalizedIde === 'webstorm' || normalizedIde === 'goland' || normalizedIde === 'rider' || normalizedIde === 'clion' || normalizedIde === 'datagrip' || normalizedIde === 'phpstorm' || normalizedIde === 'rubymine' || normalizedIde === 'rustrover' || normalizedIde === 'appcode' || normalizedIde === 'kubectl') {
    return 'https://www.jetbrains.com/idea/guide/tips/open-in-ide/';
  }

  if (normalizedIde === 'vscodium') {
    return `vscodium://file/${normalizedPath}:${target.line}:${target.col}`;
  }

  return `vscode://file/${normalizedPath}:${target.line}:${target.col}`;
};

// Icons from thesvg.org - VS Code not available, using generic code icon as fallback
const VS_CODE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 3l-5 4.5 5 4.5v-3.1c3.2 0 6 1.3 7.9 3.4L17 9.3C15.3 7.5 12.8 6.5 8 6.5V6L3 10.5 8 15v-3c4.7 0 9.3 1.5 13 4.2l-1.5-1.3C15.3 11.2 11.7 10 8 10V3zm9 5l5-4.5-5-4.5v3.1c-3.2 0-6-1.3-7.9-3.4L9 7.7c1.7 1.8 4.2 2.8 9 2.8V10l5-4.5-5-4.5v3c-4.7 0-9.3-1.5-13-4.2l1.5 1.3c4.2 3.7 7.8 4.9 11.5 4.9V8z"/></svg>';
const VSCODIUM_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/></svg>';
const CURSOR_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23"/></svg>';
const JETBRAINS_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2.345 23.997A2.347 2.347 0 0 1 0 21.652V10.988C0 9.665.535 8.37 1.473 7.433l5.965-5.961A5.01 5.01 0 0 1 10.989 0h10.666A2.347 2.347 0 0 1 24 2.345v10.664a5.056 5.056 0 0 1-1.473 3.554l-5.965 5.965A5.017 5.017 0 0 1 13.007 24v-.003H2.345Zm8.969-6.854H5.486v1.371h5.828v-1.371ZM3.963 6.514h13.523v13.519l4.257-4.257a3.936 3.936 0 0 0 1.146-2.767V2.345c0-.678-.552-1.234-1.234-1.234H10.989a3.897 3.897 0 0 0-2.767 1.145L3.963 6.514Zm-.192.192L2.256 8.22a3.944 3.944 0 0 0-1.145 2.768v10.664c0 .678.552 1.234 1.234 1.234h10.666a3.9 3.9 0 0 0 2.767-1.146l1.512-1.511H3.771V6.706Z"/></svg>';
const ZED_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>';
const SUBLIME_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"/></svg>';
const TEXTMATE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c.83 0 1.5.67 1.5 1.5 0 .55-.45 1-1 1s-1-.45-1-1c0-.83.67-1.5 1.5-1.5z"/></svg>';
const WEBSTORM_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M0 0v24h24V0H0zm17.889 2.889c1.444 0 2.667.444 3.667 1.278l-1.111 1.667c-.889-.611-1.722-1-2.556-1s-1.278.389-1.278.889v.056c0 .667.444.889 2.111 1.333 2 .556 3.111 1.278 3.111 3v.056c0 2-1.5 3.111-3.611 3.111-1.5-.056-3-.611-4.167-1.667l1.278-1.556c.889.722 1.833 1.222 2.944 1.222.889 0 1.389-.333 1.389-.944v-.056c0-.556-.333-.833-2-1.278-2-.5-3.222-1.056-3.222-3.056v-.056c0-1.833 1.444-3 3.444-3zm-16.111.222h2.278l1.5 5.778 1.722-5.778h1.667l1.667 5.778 1.5-5.778h2.333l-2.833 9.944H9.723L8.112 7.277l-1.667 5.778H4.612L1.779 3.111zm.5 16.389h9V21h-9v-1.5z"/></svg>';
const PYCHARM_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>';
const BBEDIT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path d="M12 6l-4 4h3v4h2v-4h3z"/></svg>';

const getIdeMeta = (ide?: string): { label: string; color: string | null; icon: string } => {
  const normalizedIde = (ide || 'unknown').toLowerCase().trim();

  if (normalizedIde === 'cursor') {
    return { label: 'Cursor', color: '#000000', icon: CURSOR_ICON };
  }

  if (normalizedIde === 'vscodium') {
    return { label: 'VSCodium', color: '#2F80ED', icon: VSCODIUM_ICON };
  }

  if (normalizedIde === 'webstorm') {
    return { label: 'WebStorm', color: '#000000', icon: WEBSTORM_ICON };
  }

  if (normalizedIde === 'pycharm') {
    return { label: 'PyCharm', color: '#000000', icon: PYCHARM_ICON };
  }

  if (normalizedIde === 'jetbrains' || normalizedIde === 'intellij' || normalizedIde === 'goland' || normalizedIde === 'rider' || normalizedIde === 'clion' || normalizedIde === 'datagrip' || normalizedIde === 'phpstorm' || normalizedIde === 'rubymine' || normalizedIde === 'rustrover' || normalizedIde === 'appcode' || normalizedIde === 'kubectl') {
    return { label: 'JetBrains', color: '#000000', icon: JETBRAINS_ICON };
  }

  if (normalizedIde === 'zed') {
    return { label: 'Zed', color: '#000000', icon: ZED_ICON };
  }

  if (normalizedIde === 'sublime' || normalizedIde === 'subl') {
    return { label: 'Sublime Text', color: '#FF9800', icon: SUBLIME_ICON };
  }

  if (normalizedIde === 'textmate') {
    return { label: 'TextMate', color: '#000000', icon: TEXTMATE_ICON };
  }

  if (normalizedIde === 'bbedit') {
    return { label: 'BBEdit', color: '#000000', icon: BBEDIT_ICON };
  }

  if (normalizedIde === 'vscode' || normalizedIde === 'code') {
    return { label: 'VS Code', color: '#007ACC', icon: VS_CODE_ICON };
  }

  return { label: 'VS Code', color: '#007ACC', icon: VS_CODE_ICON };
};

export { isFilePath, resolveIdeLink, getIdeMeta };
export type { LinkTarget, IdeLinkFn, IdeType };
