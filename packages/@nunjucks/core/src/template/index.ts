// WHY: this subpath deliberately THROWS where the main `@nunjucks/core` entry returns
// Result values. It implements the original-nunjucks `env.getTemplate` / `Template.render`
// engine contract (a template-state machine whose load/compile/render phases throw as
// fatal signals) and is consumed only by the render pipeline, which catches and converts
// every throw back into `err(...)` at the boundary.
// Public consumers should use the engine's Result-based render/renderToStream instead.
export { createTemplate } from './create-template.ts';
export type { TemplateObject, TemplateSource } from './types.ts';
export { Template } from './types.ts';
