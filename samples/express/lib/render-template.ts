import { render } from '@nunjucks/core';
import { isErr } from '@nunjucks/shared';

const renderTemplate = async (
  template: string,
  context: Record<string, unknown> = {},
  options: Record<string, unknown> = {},
): Promise<string> => {
  const result = await render(template, context, options);
  if (isErr(result)) {
    throw result.error;
  }
  return result.value;
};

export { renderTemplate };
