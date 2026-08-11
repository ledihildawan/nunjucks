import path from 'node:path';

export const containsNullByte = (name: string): boolean => name.includes('\0');

export const isWithinBase = (basePath: string, fullPath: string): boolean => {
  const relative = path.relative(basePath, fullPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};
