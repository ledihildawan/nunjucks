import path from 'node:path';

// WHY: a NUL byte in a file name is a cheap first line of defense against path-traversal attempts that smuggle null terminators (e.g. "..\0/") past length-based checks.
const containsNullByte = (name: string): boolean => name.includes('\0');

const isWithinBase = (basePath: string, fullPath: string): boolean => {
  const relative = path.relative(basePath, fullPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

export { containsNullByte, isWithinBase };