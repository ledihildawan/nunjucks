import { render } from '../render.ts';

// WHY: a render() wrapper in its OWN module (simulating an Express renderTemplate helper that lives in a separate file). Returns render()'s Result unchanged — render() already enriched any error with source-trace info; this fixture exists only to place render() one stack frame above the caller, so cross-file stack walking can be verified.
interface ExternalWrapperCall {
  template: string;
  context: Record<string, unknown>;
  config: Record<string, unknown>;
}

export const renderViaExternalWrapper = ({
  template,
  context,
  config,
}: ExternalWrapperCall): ReturnType<typeof render> => render(template, { context, ...config });
