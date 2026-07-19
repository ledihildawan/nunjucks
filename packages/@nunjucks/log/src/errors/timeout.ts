import type { Classification, ClassifyInput } from './types.ts';

export const TIMEOUT_CLASSIFICATION: Classification = {
  category: 'timeout_error',
  undefinedName: null,
  causes: [
    'Template **timed out**',
    'Possible infinite loop or large data processing'
  ],
  fixCode: 'Increase executionTimeout or optimize template',
  fixComment: 'Set executionTimeout to a higher value or simplify template'
};

export const timeoutClassifier = (input: ClassifyInput): Classification | null => {
  if (input.code === 'TIMEOUT') {
    return TIMEOUT_CLASSIFICATION;
  }
  return null;
};
