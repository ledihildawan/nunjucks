// WHY: the loader contract lives in @nunjucks/loaders (the package that owns template
// resolution), not in @nunjucks/lib — keeping it in the utils layer forced a lib →
// error-formatter type edge that was both an undeclared phantom dependency and the
// repo's only import cycle (error-formatter → error-renderer → error-catalog → lib).
import type { TemplateError } from '@nunjucks/error-formatter';
import type { Result } from '@nunjucks/lib';

/**
 * Source location of a loaded template.
 * @property src - The template source content.
 * @property path - The resolved path/URI of the template.
 */
export interface TemplateLoaderSource {
  src: string;
  path: string;
}

/**
 * Template loader interface for custom template resolution.
 * @method getSource - Resolves a template name to its source and path; `null` defers
 * to the next loader in the chain.
 */
export interface TemplateLoader {
  getSource: (name: string) => Promise<Result<TemplateLoaderSource, TemplateError> | null>;
}
