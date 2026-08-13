// WHY: node:path is a pure string-manipulation module (no disk/network I/O).
// It is the canonical, cross-platform path-normalization utility. Importing it
// here does not violate the §2 pure-core contract — path-security performs only
// synchronous string transforms (relative, isAbsolute, normalize). Lib remains
// side-effect free; this is a standard-runtime dependency, not an I/O boundary.
import path from 'node:path';

// WHY: a NUL byte in a file name is a cheap first line of defense against path-traversal attempts that smuggle null terminators (e.g. "..\0/") past length-based checks.
const containsNullByte = (name: string): boolean => name.includes('\0');

const isWithinBase = (basePath: string, fullPath: string): boolean => {
  const relative = path.relative(basePath, fullPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

export { containsNullByte, isWithinBase };