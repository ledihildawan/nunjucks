import { type NunjucksConfig, nunjucks } from '@nunjucks/core';
import type { Result } from '@nunjucks/lib';

/**
 * WHY (module seam): rendering by template NAME is deliberately I/O-adjacent — name
 * resolution must reach the filesystem, but only through the `views` config, which is
 * always shell-injected (routes build configs via views-path.ts); this domain file
 * therefore stays import-clean of node/express/fs, and inline-source rendering (the
 * renderDemoTemplate baseline) stays pure.
 */

interface RenderTemplateOptions {
  context?: Record<string, unknown>;
  config?: NunjucksConfig;
}

/**
 * Renders a template through a freshly built engine — the sample's single render
 * seam. Returns the engine's `Result` so shell adapters (`sendTemplateResult`)
 * decide between success output and the central error handler.
 *
 * WHY: a fresh engine is built per call so each route's filter/security/limits
 * overrides stay isolated; the demo's `/errors` routes intentionally vary these
 * per scenario, so memoizing the factory would couple unrelated routes'
 * configuration. The cost is acceptable because the factory is cheap and the
 * sample server is single-process for demonstration.
 *
 * @param template - Template name resolved via `views`, or inline source.
 * @param options - Render context plus engine config overrides for this call.
 * @returns Result string, or `Err` carrying the engine's `TemplateError`.
 */
const renderTemplate = (
  template: string,
  { context = {}, config = {} }: RenderTemplateOptions = {}
): Promise<Result<string, Error>> => nunjucks(config).render(template, context);

// WHY: alias instead of a duplicate interface — the demo wrapper accepts exactly the
// same options as the seam it layers; a second copy would only drift.
type RenderDemoTemplateOptions = RenderTemplateOptions;

/**
 * Renders with the demo's baseline config — autoescape on, `dev` diagnostics on,
 * vscode IDE links — layering caller overrides on top; the shared base keeps the
 * sandbox and undefined-variable route groups visually consistent.
 *
 * @param template - Template name or inline source (see {@link renderTemplate}).
 * @param options - Render context plus config overrides merged over the baseline.
 * @returns Result string, or `Err` carrying the engine's `TemplateError`.
 */
const renderDemoTemplate = async (
  template: string,
  { context = {}, config = {} }: RenderDemoTemplateOptions = {}
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

export { renderDemoTemplate, renderTemplate };
