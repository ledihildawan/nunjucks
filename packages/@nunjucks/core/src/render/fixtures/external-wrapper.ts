import { render } from '../render.ts';
import { isErr } from '@nunjucks/shared';

// WHY: simulates a real-world render() wrapper that lives in its OWN module (e.g. an Express renderTemplate helper), one stack frame above the caller that owns the template literal. Used by error-locations.test.ts to verify the source trace walks up the stack to the file that actually contains the literal instead of fixating on this wrapper.
interface ExternalWrapperCall {
  template: string;
  context: Record<string, unknown>;
  config: Record<string, unknown>;
}

export const renderViaExternalWrapper = async ({ template, context, config }: ExternalWrapperCall): Promise<string> => {
  const result = await render(template, { context, ...config });
  if (isErr(result)) {
    throw result.error;
  }
  return result.value;
};
