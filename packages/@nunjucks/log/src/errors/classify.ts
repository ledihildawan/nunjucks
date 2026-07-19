import type { Classification } from './types.ts';
import { classifyInput } from './classifiers.ts';

export interface ClassifyInput {
  message?: string;
  code?: string;
  subject?: string;
}

export const classify = (message: string): Classification => {
  return classifyInput({ message });
};

export const classifyFromError = (error: { message?: string; code?: string; subject?: string } | null): Classification => {
  if (!error) {
    return {
      category: 'unknown',
      undefinedName: null,
      causes: ['Unknown error occurred'],
      fixCode: null,
      fixComment: null
    };
  }
  return classifyInput({
    message: error.message,
    code: error.code,
    subject: error.subject
  });
};

export { classifyInput };
