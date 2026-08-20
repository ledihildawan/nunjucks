import { getError } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import { createLog } from '@nunjucks/error-formatter';
import { err, isErr, type Result } from '@nunjucks/lib';
import type { TemplateLoader, TemplateLoaderSource } from './loader-contract.ts';

export type { TemplateLoader, TemplateLoaderSource } from './loader-contract.ts';

interface ResolveChainInput {
  loaders: readonly TemplateLoader[];
  name: string;
}

// WHY: a JS caller's custom loader may resolve ok() with a malformed payload (non-string
// src/path) — trusting the TS contract lets the defect surface far downstream as a
// cache-key/compile failure; rejecting at the chain boundary keeps it diagnosable at the
// loader that produced it.
const validateLoaderSource = (
  result: Result<TemplateLoaderSource, TemplateError>,
  name: string
): Result<TemplateLoaderSource, TemplateError> => {
  if (
    isErr(result) ||
    (typeof result.value.src === 'string' && typeof result.value.path === 'string')
  ) {
    return result;
  }
  return err(
    createLog('error', {
      def: getError('FILESYSTEM_ERROR'),
      params: {
        msg: `custom loader returned a malformed source for '${name}' (src/path must be strings)`,
      },
      subject: name,
      context: { phase: 'load' },
    })
  );
};

// WHY: recursive first-match-wins — the first loader returning a non-null result (ok OR
// err) ends resolution; null defers to the next loader. Mirrors findFileInSearchPaths.
const resolveChainSource = async ({
  loaders,
  name,
}: ResolveChainInput): Promise<Result<TemplateLoaderSource, TemplateError> | null> => {
  const [firstLoader, ...remainingLoaders] = loaders;
  if (firstLoader === undefined) {
    return null;
  }
  const result = await firstLoader.getSource(name);
  if (result !== null) {
    return validateLoaderSource(result, name);
  }
  return resolveChainSource({ loaders: remainingLoaders, name });
};

/**
 * Folds an ordered list of loaders into a single first-match-wins loader.
 *
 * Resolution walks the array front-to-back: the first loader returning a
 * non-null result (ok OR err) ends resolution; `null` defers to the next
 * loader; an exhausted chain resolves `null` (caller decides miss handling).
 * A malformed `ok` payload (non-string `src`/`path`) is converted to a
 * `FILESYSTEM_ERROR` at this boundary so the defect stays attributable to
 * the loader that produced it.
 */
const createLoaderChain = (loaders: readonly TemplateLoader[]): TemplateLoader => ({
  getSource: (name: string) => resolveChainSource({ loaders, name }),
});

export { createLoaderChain };
