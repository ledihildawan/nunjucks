import { render } from './render.ts';
import { isErr } from '@nunjucks/lib';
import type { GlobalConfig } from '../config/global.ts';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}, config: Partial<GlobalConfig> = {}): Promise<string> => {
  const result = await render(template, { context, autoescape: false, ...config });
  if (isErr(result)) { throw result.error; }
  return result.value;
};

export { renderTemplate };
