import { ok, err, type Result, escapeHtml } from '@nunjucks/lib';

type TemplateSource = string & { readonly __brand: unique symbol };

const createTemplateSource = (value: unknown): Result<TemplateSource, Error> => {
  if (typeof value !== 'string') {
    const errObj: Error & { code?: string } = new Error('Template must be a string');
    errObj.code = 'TEMPLATE_MUST_BE_STRING';
    return err(errObj);
  }
  return ok(value as TemplateSource);
};

export { escapeHtml, createTemplateSource };
