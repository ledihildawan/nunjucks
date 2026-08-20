import type { TemplateError } from '@nunjucks/error-formatter';
import type { Result } from '@nunjucks/lib';

export interface TemplateLoaderSource {
  src: string;
  path: string;
}

export interface TemplateLoader {
  getSource: (name: string) => Promise<Result<TemplateLoaderSource, TemplateError> | null>;
}
