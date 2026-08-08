import { render } from './render.ts';
import { isErr } from '@nunjucks/shared';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}, config: Record<string, unknown> = {}): Promise<string> => {
  const result = await render(template, { context, autoescape: false, ...config });
  if (isErr(result)) { throw result.error; }
  return result.value;
};

export { renderTemplate };
