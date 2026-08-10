import { nunjucks, type NunjucksConfig } from '@nunjucks/core';
import { isErr } from '@nunjucks/shared';

// WHY: simplified sample helper — builds a fresh factory PER CALL because each demo route passes a different
// config (security/limits/etc.). This is fine for a low-traffic demo, but do NOT copy this pattern for
// production per-request rendering: rebuilding the factory also rebuilds the filter/global merge and the loader
// cache every request. For production, create ONE nunjucks(config) engine at module load (see
// @nunjucks/integrations/express createEngine, or samples/express/main.ts streamNjk/blockingNjk) and reuse it.
const renderTemplate = async (
  template: string,
  context: Record<string, unknown> = {},
  config: NunjucksConfig = {},
): Promise<string> => {
  const result = await nunjucks(config).render(template, context);
  // WHY: this sample integrates with Express, whose error-middleware pattern routes failures
  // via next(err). We intentionally unwrap the Result here so render errors surface as thrown
  // exceptions that Express's error middleware can intercept and render.
  if (isErr(result)) {
    throw result.error;
  }
  return result.value;
};

export { renderTemplate };

