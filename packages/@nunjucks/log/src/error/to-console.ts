import picocolors from 'picocolors';
import { pipe, filter } from 'remeda';
import { shortenPath } from '@nunjucks/shared/path-shortener';
import { isFilePath, resolveIdeLink } from './ide-links.ts';
import { toDisplayLocation } from '../shared/location.ts';

const makeHyperlink = (text: string, url: string): string => {
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
};

export interface Warning {
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

export interface ToConsoleOptions {
  verbosity?: 'simple' | 'medium' | 'full';
  dev?: boolean;
  ide?: string;
  templatePath?: string;
  version?: string;
  timestamp?: string;
}

const formatSimple = (warning: Warning): string => {
  const title = warning.varName
    ? `Undefined variable '${warning.varName}'`
    : 'Undefined variable';
  return `${picocolors.bgYellow(picocolors.black('[WARNING]'))} ${picocolors.yellow(title)}`;
};

const formatMedium = (warning: Warning, options: ToConsoleOptions): string => {
  const { templatePath, ide = 'vscode' } = options;
  const { lineno, templateName, varName } = warning;

  const title = varName
    ? `Undefined variable '${varName}'`
    : 'Undefined variable';

  const location = toDisplayLocation(lineno ?? null, 0, warning.lineBase ?? 'zero');
  const lineNum = location.line;

  let locationStr: string;
  const path = templateName || templatePath;
  if (path) {
    const shortPath = shortenPath(path);
    const displayPath = `${shortPath}:${lineNum}`;
    const location = isFilePath(path)
      ? makeHyperlink(displayPath, resolveIdeLink(ide, path, lineNum, 1))
      : displayPath;
    locationStr = `${picocolors.dim('at')} ${location}`;
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

const formatFull = (warning: Warning, options: ToConsoleOptions): string => {
  const { dev = false, version = '3.2.4', timestamp, ide = 'vscode' } = options;
  const { lineno, templateName, varName, undefinedMode, code, subject } = warning;

  const parts: string[] = [];

  parts.push(picocolors.bgYellow(picocolors.black('[WARNING]')) + ' ' + picocolors.bold('Template Warning'));

  if (code) {
    parts.push(picocolors.yellow(`[${code}]`));
  }

  if (undefinedMode && dev) {
    parts.push(picocolors.dim(`(${undefinedMode})`));
  }

  parts.push('');

  const title = varName
    ? `Undefined variable '${varName}'`
    : 'Undefined variable';
  parts.push(picocolors.bold('Message:') + ' ' + picocolors.yellow(title));

  const location = toDisplayLocation(lineno ?? null, 0, warning.lineBase ?? 'zero');
  const lineNum = location.line;
  let locationStr: string;
  if (templateName) {
    const shortPath = shortenPath(templateName);
    const displayPath = `${shortPath}:${lineNum}`;
    locationStr = isFilePath(templateName)
      ? makeHyperlink(displayPath, resolveIdeLink(ide, templateName, lineNum, 1))
      : displayPath;
  } else if (lineno !== undefined && lineno !== null) {
    locationStr = picocolors.dim(`line ${lineNum}`);
  } else {
    locationStr = picocolors.dim('unknown');
  }
  parts.push(picocolors.bold('Location:') + ' ' + locationStr);

  if (dev && subject) {
    parts.push('');
    parts.push(picocolors.bold('Subject:') + ' ' + picocolors.cyan(subject));
  }

  const footer = [`Nunjucks ${version}`];
  if (timestamp) {
    footer.push(timestamp);
  }
  parts.push('');
  parts.push(picocolors.dim(footer.join(' · ')));

  return parts.join('\n');
};

export const toConsoleString = (warning: Warning, options: ToConsoleOptions = {}): string => {
  const { verbosity = 'full' } = options;

  if (verbosity === 'simple') {
    return formatSimple(warning);
  }

  if (verbosity === 'medium') {
    return formatMedium(warning, options);
  }

  return formatFull(warning, options);
};
