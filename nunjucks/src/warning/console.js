import picocolors from 'picocolors';
import { shortenPath } from '../shared/path-shortener.js';

export const toConsoleString = (warning) => {
  const { message, lineno, colno, templateName, varName } = warning;

  const lineNum = lineno + 1;

  let locationStr;
  if (templateName) {
    const shortPath = shortenPath(templateName);
    locationStr = `(${shortPath}:${lineNum})`;
  } else {
    locationStr = `${lineNum}`;
  }

  const title = varName
    ? `Undefined variable '${varName}'`
    : 'Undefined variable';

  const parts = [
    picocolors.bgYellow(picocolors.black('[WARNING]')),
    picocolors.yellow(title),
    picocolors.dim('at'),
    picocolors.cyan(locationStr)
  ].filter(Boolean);

  return parts.join(' ');
};
