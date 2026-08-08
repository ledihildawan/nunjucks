import { createRenderRuntime } from '@nunjucks/runtime';

export { createRuntimeWithContext };

import type { RuntimeContext } from './runtime-context.ts';

const createRuntimeWithContext = (templatePath: string | undefined, renderContext: unknown = null): RuntimeContext =>
  // WHY: createRenderRuntime infers __warnings__ and logContext as optional (conditional spread on its options param), but this caller always passes options, so both fields are always present at runtime. Removing the cast would require overloading createRenderRuntime across the runtime package — disproportionate to this single call site.
  createRenderRuntime({ templateName: templatePath, renderContext }) as RuntimeContext;
