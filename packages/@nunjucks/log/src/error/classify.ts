import { classifyFromError } from './classify/classify.js';

export interface ClassifiedError {
  category: string;
  message: string;
  undefinedName: string | null;
  title: string | null;
  causes: string[];
  fixCode: string | null;
  fixComment: string | null;
  lineno: number | null;
  colno: number | null;
  rawMessage: string;
}

export interface ClassifyInput {
  message?: string;
  lineno?: number | null;
  colno?: number | null;
  code?: string;
  subject?: string;
  phase?: string;
  templateName?: string;
  stack?: string;
}

export const classify = (error: ClassifyInput | null): ClassifiedError | null => {
  if (!error) return null;

  const classified = classifyFromError(error);

  return {
    category: classified.category || 'unknown',
    message: error.message || String(error),
    undefinedName: classified.undefinedName ?? null,
    title: classified.title ?? null,
    causes: classified.causes || [],
    fixCode: classified.fixCode ?? null,
    fixComment: classified.fixComment ?? null,
    lineno: error.lineno ?? null,
    colno: error.colno ?? null,
    rawMessage: error.message ?? ''
  };
};
