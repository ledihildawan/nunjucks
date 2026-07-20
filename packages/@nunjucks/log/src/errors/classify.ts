import type { Classification } from './types.ts';
import { classifyInput } from './classifier.ts';

export interface ClassifyInput {
  message?: string;
  code?: string;
  subject?: string;
}

interface ErrorWithExtras {
  message?: string;
  code?: string;
  subject?: string;
  causes?: string[];
  fixCode?: string | null;
  fixComment?: string | null;
}

export const classify = (message: string): Classification => {
  return classifyInput({ message });
};

export const classifyFromError = (error: ErrorWithExtras | null): Classification => {
  if (!error) {
    return {
      category: 'unknown',
      undefinedName: null,
      causes: ['Unknown error occurred'],
      fixCode: null,
      fixComment: null,
      documentationUrl: null,
      severity: 'error'
    };
  }
  return classifyInput({
    message: error.message,
    code: error.code,
    subject: error.subject,
    causes: error.causes,
    fixCode: error.fixCode ?? undefined,
    fixComment: error.fixComment ?? undefined
  });
};

export { classifyInput };
