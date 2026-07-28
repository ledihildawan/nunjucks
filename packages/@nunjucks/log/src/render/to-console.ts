import picocolors from 'picocolors';
import { pipe, filter } from 'remeda';
import { shortenPath } from './internal/path-shortener.ts';
import { isFilePath, resolveIdeLink } from './internal/ide-links.ts';
import { toDisplayLocation } from './internal/location.ts';

const makeHyperlink = (text: string, url: string): string => `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;

interface Warning {
  message?: string;
  lineno?: number | null;
  colno?: number | null;
  varName?: string | null;
  templateName?: string | null;
  undefinedMode?: string;
  code?: string | null;
  subject?: string | null;
  lineBase?: 'zero' | 'one' | null;
}

interface ToConsoleOptions {
  verbosity?: 'simple' | 'medium' | 'full';
  dev?: boolean;
  ide?: string;
  templatePath?: string;
  version?: string;
  timestamp?: string;
}

const formatSimple = (warning: Warning): string => {
  let title: string;
  if (warning.varName) {
    title = `Undefined variable '${warning.varName}'`;
  } else {
    title = 'Undefined variable';
  }
  return `${picocolors.bgYellow(picocolors.black('[WARNING]'))} ${picocolors.yellow(title)}`;
};

const formatMedium = (warning: Warning, options: ToConsoleOptions): string => {
  const { templatePath, ide = 'vscode' } = options;
  const { lineno, templateName, varName } = warning;

  let title: string;
  if (varName) {
    title = `Undefined variable '${varName}'`;
  } else {
    title = 'Undefined variable';
  }

  const location = toDisplayLocation(lineno ?? null, 0, warning.lineBase ?? 'zero');
  const lineNum = location.line;

  let locationStr: string;
  const path = templateName || templatePath;
  if (path) {
    const shortPath = shortenPath(path);
    const displayPath = `${shortPath}:${lineNum}`;
    let locationText: string;
    if (isFilePath(path)) {
      locationText = makeHyperlink(displayPath, resolveIdeLink(ide, path, lineNum, 1));
    } else {
      locationText = displayPath;
    }
    locationStr = `${picocolors.dim('at')} ${locationText}`;
  } else {
    locationStr = `${picocolors.dim('at line')} ${picocolors.cyan(lineNum)}`;
  }

  const parts = pipe(
    [
      picocolors.bgYellow(picocolors.black('[WARNING]')),
      picocolors.yellow(title),
      locationStr
    ],
    filter(Boolean)
  );

  return parts.join(' ');
};

const getWarningTitle = (varName: string | null | undefined): string =>
  varName ? `Undefined variable '${varName}'` : 'Undefined variable';

const getLocationString = (lineno: number | null | undefined, templateName: string | null | undefined, lineBase: 'zero' | 'one' | null | undefined, ide: string): string => {
  const location = toDisplayLocation(lineno ?? null, 0, lineBase ?? 'zero');
  const lineNum = location.line;
  if (templateName) {
    const shortPath = shortenPath(templateName);
    const displayPath = `${shortPath}:${lineNum}`;
    const locationText = isFilePath(templateName)
      ? makeHyperlink(displayPath, resolveIdeLink(ide, templateName, lineNum, 1))
      : displayPath;
    return locationText;
  }
  if (lineno !== undefined && lineno !== null) {
    return picocolors.dim(`line ${lineNum}`);
  }
  return picocolors.dim('unknown');
};

const formatFull = (warning: Warning, options: ToConsoleOptions): string => {
  const { dev = false, version = '3.2.4', timestamp, ide = 'vscode' } = options;
  const { lineno, templateName, varName, undefinedMode, code, subject } = warning;

  const parts: string[] = [];
  parts.push(`${picocolors.bgYellow(picocolors.black('[WARNING]'))} ${picocolors.bold('Template Warning')}`);

  if (code) {
    parts.push(picocolors.yellow(`[${code}]`));
  }
  if (undefinedMode && dev) {
    parts.push(picocolors.dim(`(${undefinedMode})`));
  }
  parts.push('');
  parts.push(`${picocolors.bold('Message:')} ${picocolors.yellow(getWarningTitle(varName))}`);
  parts.push(`${picocolors.bold('Location:')} ${getLocationString(lineno, templateName, warning.lineBase, ide)}`);

  if (dev && subject) {
    parts.push('');
    parts.push(`${picocolors.bold('Subject:')} ${picocolors.cyan(subject)}`);
  }

  const footer = [`Nunjucks ${version}`];
  if (timestamp) {
    footer.push(timestamp);
  }
  parts.push('');
  parts.push(picocolors.dim(footer.join(' · ')));

  return parts.join('\n');
};

const toConsoleString = (warning: Warning, options: ToConsoleOptions = {}): string => {
  const { verbosity = 'full' } = options;

  if (verbosity === 'simple') {
    return formatSimple(warning);
  }

  if (verbosity === 'medium') {
    return formatMedium(warning, options);
  }

  return formatFull(warning, options);
};

export { toConsoleString };
export type { Warning, ToConsoleOptions };
