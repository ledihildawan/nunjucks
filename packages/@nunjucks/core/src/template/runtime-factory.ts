import { createRenderRuntime } from '@nunjucks/runtime';

export { createRuntimeWithContext };

import type { RuntimeContext } from './runtime-context.ts';

const createRuntimeWithContext = (templatePath: string | undefined, renderContext: unknown = null): RuntimeContext =>
  createRenderRuntime({ templateName: templatePath, renderContext }) as RuntimeContext;
