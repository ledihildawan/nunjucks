import picocolors from 'picocolors';
import { pipe, filter } from 'remeda';
import { shortenPath, normalizeDrivePath } from '../../shared/path-shortener.js';

const makeHyperlink = (text, url) => {
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
};

const formatSimple = (warning) => {
  const title = warning.varName
    ? `Undefined variable '${warning.varName}'`
    : 'Undefined variable';
  return `${picocolors.bgYellow(picocolors.black('[WARNING]'))} ${picocolors.yellow(title)}`;
};

const formatMedium = (warning, options) => {
  const { templatePath, ide = 'vscode' } = options;
  const { lineno, templateName, varName } = warning;

  const title = varName
    ? `Undefined variable '${varName}'`
    : 'Undefined variable';

  const lineNum = (lineno ?? 0) + 1;

  let locationStr;
  if (templateName || templatePath) {
    const path = templateName || templatePath;
    const shortPath = shortenPath(path);
    const displayPath = `${shortPath}:${lineNum}`;
    const normalizedPath = normalizeDrivePath(path);
    const vscodeUrl = `vscode://file/${normalizedPath}:${lineNum}`;
    const link = makeHyperlink(displayPath, vscodeUrl);
    locationStr = `${picocolors.dim('at')} ${link}`;
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

const formatFull = (warning, options) => {
  const { dev = false } = options;
  const { lineno, templateName, varName, undefinedMode, code, subject } = warning;

  const parts = [];

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

  const lineNum = (lineno ?? 0) + 1;
  let locationStr;
  if (templateName) {
    const shortPath = shortenPath(templateName);
    const displayPath = `${shortPath}:${lineNum}`;
    const normalizedPath = normalizeDrivePath(templateName);
    const vscodeUrl = `vscode://file/${normalizedPath}:${lineNum}`;
    const link = makeHyperlink(displayPath, vscodeUrl);
    locationStr = link;
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

  parts.push('');
  parts.push(picocolors.dim(`Nunjucks 3.2.4 · ${new Date().toISOString()}`));

  return parts.join('\n');
};

export const toConsoleString = (warning, options = {}) => {
  const { verbosity = 'full' } = options;

  if (verbosity === 'simple') {
    return formatSimple(warning);
  }

  if (verbosity === 'medium') {
    return formatMedium(warning, options);
  }

  return formatFull(warning, options);
};
