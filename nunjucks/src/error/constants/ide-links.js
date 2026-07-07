const GENERIC_ICON = '<path d="M14 3v2h3.59l-9.3 9.29 1.42 1.42L19 6.41V10h2V3m-2 16H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7z"/>';

export const IDE_SCHEMES = {
  vscode: {
    label: 'VS Code',
    color: '#0098FF',
    link: (p, l, c) => `vscode://file/${p}:${l}:${c}`,
    icon: '<path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 19.47V4.528a1.5 1.5 0 0 0-.85-1.342zM17.948 19.68L9.94 12l8.008-7.68v15.36z"/>',
  },
  'vscode-insiders': {
    label: 'VS Code Insiders',
    color: '#00B1A7',
    link: (p, l, c) => `vscode-insiders://file/${p}:${l}:${c}`,
    icon: '<path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 19.47V4.528a1.5 1.5 0 0 0-.85-1.342zM17.948 19.68L9.94 12l8.008-7.68v15.36z"/>',
  },
  cursor: {
    label: 'Cursor',
    color: '#00A1F1',
    link: (p, l, c) => `cursor://file/${p}:${l}:${c}`,
    icon: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
  },
  windsurf: {
    label: 'Windsurf',
    color: '#1E90FF',
    link: (p, l, c) => `windsurf://file/${p}:${l}:${c}`,
    icon: '<path d="M2 12c2-6 6-10 10-10s8 4 10 10c-2 6-6 10-10 10S4 18 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12l4-4 4 4-4 4z"/>',
  },
  zed: {
    label: 'Zed',
    color: '#00C8C8',
    link: (p, l, c) => `zed://file/${p}:${l}`,
    icon: '<path d="M5 4h14L7 14h12v6H5L17 10H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  },
  webstorm: {
    label: 'WebStorm',
    color: '#07C3F2',
    link: (p, l, c) => `webstorm://open?path=${encodeURIComponent(p)}&line=${l}`,
    icon: GENERIC_ICON,
  },
  intellij: {
    label: 'IntelliJ IDEA',
    color: '#FF7043',
    link: (p, l, c) => `idea://open?path=${encodeURIComponent(p)}&line=${l}`,
    icon: GENERIC_ICON,
  },
  phpstorm: {
    label: 'PhpStorm',
    color: '#B12E description',
    link: (p, l, c) => `phpstorm://open?path=${encodeURIComponent(p)}&line=${l}`,
    icon: GENERIC_ICON,
  },
  pycharm: {
    label: 'PyCharm',
    color: '#4CAF50',
    link: (p, l, c) => `pycharm://open?path=${encodeURIComponent(p)}&line=${l}`,
    icon: GENERIC_ICON,
  },
  sublime: {
    label: 'Sublime Text',
    color: '#FF9800',
    link: (p, l, c) => `subl://open?url=file://${p}&line=${l}`,
    icon: GENERIC_ICON,
  },
};

const DEFAULT_META = { label: 'IDE', color: null, icon: GENERIC_ICON };

export const resolveIdeLink = (ide, path, line, col) => {
  if (typeof ide === 'function') return ide(path, line, col);
  const entry = IDE_SCHEMES[ide] || IDE_SCHEMES.vscode;
  return entry.link(path, line, col);
};

export const getIdeMeta = (ide) => {
  if (typeof ide === 'function') return DEFAULT_META;
  return IDE_SCHEMES[ide] || IDE_SCHEMES.vscode;
};
