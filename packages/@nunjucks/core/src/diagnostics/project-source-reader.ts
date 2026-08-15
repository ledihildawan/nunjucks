import { readFileSync } from 'node:fs';
import type { ProjectSourceContent, ProjectSourceLocation } from '@nunjucks/error-formatter';

const isProjectSource = (path: string): boolean => {
  const normalized = path.replace(/\\/g, '/');
  return !normalized.includes('/node_modules/');
};

export const readProjectSource = (location: ProjectSourceLocation): ProjectSourceContent | null => {
  if (location.line === null || !isProjectSource(location.path)) {
    return null;
  }
  try {
    return {
      sourceContent: readFileSync(location.path, 'utf-8'),
      templatePath: location.path,
      lineno: location.line,
      colno: location.col ?? 1,
    };
  } catch {
    return null;
  }
};
