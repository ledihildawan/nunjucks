import { render } from '@nunjucks/core';
import { isErr } from '@nunjucks/shared';

const renderTemplate = async (
  template: string,
  context: Record<string, unknown> = {},
  options: Record<string, unknown> = {},
): Promise<string> => {
  const result = await render(template, { context, ...options });
  // WHY: this sample integrates with Express, whose error-middleware pattern routes failures
  // via next(err). We intentionally unwrap the Result here so render errors surface as thrown
  // exceptions that Express's error middleware can intercept and render.
  if (isErr(result)) {
    throw result.error;
  }
  return result.value;
};

export { renderTemplate };
