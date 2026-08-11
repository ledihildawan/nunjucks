import { isKeyedObject } from '@nunjucks/lib';

const TEMPLATE_ERROR = Symbol('TemplateError');

interface BrandedTemplateError {
  [TEMPLATE_ERROR]?: boolean;
}

const isTemplateError = (value: unknown): value is BrandedTemplateError =>
  isKeyedObject(value) && value[TEMPLATE_ERROR] === true;

export { TEMPLATE_ERROR, isTemplateError };
export type { BrandedTemplateError };
