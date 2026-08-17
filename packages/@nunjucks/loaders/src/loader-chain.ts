import { getError } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import { createLog } from '@nunjucks/error-formatter';
import { err, isErr, type Result } from '@nunjucks/lib';

// WHY: the minimal loader contract the render pipeline consumes — getSource resolves a
// template name to source text. `null` means "not found here" (a chain moves on to the
// next loader); `err` is a hard failure (filesystem error, permission denied) that aborts
// resolution; `ok` carries the source. Note: the built-in FS loader treats a
// traversal-blocked name as a MISS (null, defers onward) — nothing is ever read for it;
// custom loaders decide their own miss-vs-error envelope. Custom loaders only need this shape.
export interface TemplateLoaderSource {
  src: string;
  path: string;
}

export interface TemplateLoader {
  getSource: (name: string) => Promise<Result<TemplateLoaderSource, TemplateError> | null>;
}

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
  if (isErr(result) || (typeof result.value.src === 'string' && typeof result.value.path === 'string')) {
    return result;
  }
  return err(
    createLog('error', {
      def: getError('FILESYSTEM_ERROR'),
      params: { msg: `custom loader returned a malformed source for '${name}' (src/path must be strings)` },
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

const createLoaderChain = (loaders: readonly TemplateLoader[]): TemplateLoader => ({
  getSource: (name: string) => resolveChainSource({ loaders, name }),
});

export { createLoaderChain };
