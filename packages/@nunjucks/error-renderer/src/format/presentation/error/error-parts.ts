import { classifyFromError } from '@nunjucks/error-catalog';

export interface MergedErrorParts {
  causes: string[];
  fixCode: string;
  fixComment: string;
  documentationUrl: string | null;
}

export const mergeErrorParts = (error: unknown): MergedErrorParts => {
  const errObj = error as {
    causes?: string[];
    fixCode?: string | null;
    fixComment?: string | null;
    documentationUrl?: string | null;
  };
  const classification = classifyFromError(errObj);
  return {
    causes: classification.causes?.length ? [...classification.causes] : [...(errObj.causes ?? [])],
    fixCode: classification.fixCode ?? errObj.fixCode ?? '',
    fixComment: classification.fixComment ?? errObj.fixComment ?? '',
    documentationUrl: classification.documentationUrl ?? errObj.documentationUrl ?? null,
  };
};
