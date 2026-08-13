import { nunjucks, type NunjucksConfig } from '@nunjucks/core';
import { ok, err, isErr, type Result } from '@nunjucks/lib';

interface RenderTemplateOptions {
  context?: Record<string, unknown>;
  config?: NunjucksConfig;
}

// WHY: a fresh engine is built per call so each route's filter/security/limits overrides stay isolated;
// the demo's `/errors` routes intentionally vary these per scenario, so memoizing the factory would
// couple unrelated routes' configuration. The cost is acceptable because the factory is cheap and the
// sample server is single-process for demonstration.
const renderTemplate = async (
  template: string,
  { context = {}, config = {} }: RenderTemplateOptions = {},
): Promise<Result<string, Error>> => {
  const result = await nunjucks(config).render(template, context);
  if (isErr(result)) {
    return err(result.error);
  }
  return ok(result.value);
};

interface RenderDemoTemplateOptions {
  context?: Record<string, unknown>;
  config?: NunjucksConfig;
}

// WHY: demo default config shared by the sandbox and undefined-variable route groups — autoescape on, dev on,
// vscode IDE hints; explicit config overrides merge on top so callers can flip undefined/security modes.
const renderDemoTemplate = async (
  template: string,
  { context = {}, config = {} }: RenderDemoTemplateOptions = {},
): Promise<Result<string, Error>> => {
  return renderTemplate(template, {
    context,
    config: {
      autoescape: true,
      dev: true,
      ide: 'vscode',
      ...config,
    },
  });
};

export { renderTemplate, renderDemoTemplate };
