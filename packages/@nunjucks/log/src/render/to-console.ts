import picocolors from 'picocolors';
import { pipe, filter } from 'remeda';
import { shortenPath } from './internal/location/path-shortener.ts';
import { isFilePath, resolveIdeLink } from './internal/config/ide-links.ts';
import { toDisplayLocation } from './internal/location/location.ts';
import type { LineBase } from '../line-base.ts';
import { makeHyperlink } from './ansi/stack-helpers.ts';
import { DEFAULT_IDE, DEFAULT_VERSION } from './internal/config/defaults.ts';
import type { Warning } from '../warning/collector.ts';

interface ToConsoleOptions {
  verbosity?: 'simple' | 'medium' | 'full';
  dev?: boolean;
  ide?: string;
  templatePath?: string;
  version?: string;
  timestamp?: string;
}

const formatSimple = (warning: Warning): string => {
  const title = warning.varName ? `Undefined variable '${warning.varName}'` : 'Undefined variable';
  return `${picocolors.bgYellow(picocolors.black('[WARNING]'))} ${picocolors.yellow(title)}`;
};

const formatMedium = (warning: Warning, options: ToConsoleOptions): string => {
  const { templatePath, ide = DEFAULT_IDE } = options;
  const { lineno, templateName, varName } = warning;

  const title = varName ? `Undefined variable '${varName}'` : 'Undefined variable';

  const location = toDisplayLocation(lineno ?? null, 0, warning.lineBase ?? 'zero');
  const lineNum = location.line;

  const path = templateName || templatePath;
  const displayPath = path ? `${shortenPath(path)}:${lineNum}` : '';
  const locationText = path && isFilePath(path)
    ? makeHyperlink(displayPath, resolveIdeLink(ide, path, lineNum, 1))
    : displayPath;
  const locationStr = path
    ? `${picocolors.dim('at')} ${locationText}`
    : `${picocolors.dim('at line')} ${picocolors.cyan(lineNum)}`;

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

const getLocationString = (lineno: number | null | undefined, templateName: string | null | undefined, lineBase: LineBase | null | undefined, ide: string): string => {
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
  const { dev = false, version = DEFAULT_VERSION, timestamp, ide = DEFAULT_IDE } = options;
  const { lineno, templateName, varName, undefinedMode, code, subject } = warning;

  const footer = [`Nunjucks ${version}`, ...(timestamp ? [timestamp] : [])];
  const parts: string[] = [
    `${picocolors.bgYellow(picocolors.black('[WARNING]'))} ${picocolors.bold('Template Warning')}`,
    ...(code ? [picocolors.yellow(`[${code}]`)] : []),
    ...(undefinedMode && dev ? [picocolors.dim(`(${undefinedMode})`)] : []),
    '',
    `${picocolors.bold('Message:')} ${picocolors.yellow(getWarningTitle(varName))}`,
    `${picocolors.bold('Location:')} ${getLocationString(lineno, templateName, warning.lineBase, ide)}`,
    ...(dev && subject ? ['', `${picocolors.bold('Subject:')} ${picocolors.cyan(subject)}`] : []),
    '',
    picocolors.dim(footer.join(' · '))
  ];

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
